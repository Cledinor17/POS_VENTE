"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ApiError } from "@/lib/api";
import { listEmployees, type EmployeeItem } from "@/lib/employeesApi";
import {
  createHotelHousekeepingTask,
  deleteHotelHousekeepingTask,
  getHotelHousekeepingTasks,
  getHotelRooms,
  updateHotelHousekeepingTask,
  type HotelHousekeepingTask,
  type HotelRoom,
} from "@/lib/hotelApi";

function getErrorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return "Une erreur est survenue.";
}

function formatDateInput(value: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
}

function normalizeSearchValue(value: string | null | undefined): string {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

type HousekeepingTaskType = "cleaning" | "inspection" | "maintenance";
type HousekeepingTaskStatus = "pending" | "in_progress" | "done" | "cancelled";

type HousekeepingStatusConfirmationState = {
  taskId: number;
  previousStatus: HousekeepingTaskStatus;
  nextStatus: HousekeepingTaskStatus;
};

function getEmployeeKeywordsForTask(taskType: HousekeepingTaskType) {
  if (taskType === "maintenance") {
    return ["maintenance", "technicien", "technician", "repair", "reparation"];
  }

  if (taskType === "inspection") {
    return ["housekeeping", "supervisor", "inspect", "inspection", "controle", "entretien"];
  }

  return ["housekeeping", "housekeeper", "cleaning", "cleaner", "entretien", "menage"];
}

function getTaskTypeLabel(taskType: string): string {
  if (taskType === "cleaning") return "Nettoyage";
  if (taskType === "inspection") return "Inspection";
  if (taskType === "maintenance") return "Maintenance";
  return taskType || "-";
}

function getTaskStatusLabel(status: string): string {
  if (status === "pending") return "En attente";
  if (status === "in_progress") return "En cours";
  if (status === "done") return "Terminee";
  if (status === "cancelled") return "Annulee";
  return status || "-";
}

function getAllowedTaskNextStatuses(status: HousekeepingTaskStatus): HousekeepingTaskStatus[] {
  if (status === "pending") return ["in_progress", "done", "cancelled"];
  if (status === "in_progress") return ["done", "cancelled"];
  return [];
}

function getTaskStatusTransitionError(task: HotelHousekeepingTask, nextStatus: HousekeepingTaskStatus): string | null {
  if (!nextStatus || nextStatus === task.status) return null;
  if (getAllowedTaskNextStatuses(task.status as HousekeepingTaskStatus).includes(nextStatus)) {
    return null;
  }

  if (task.status === "done") {
    return "Impossible de modifier une tache housekeeping terminee.";
  }

  if (task.status === "cancelled") {
    return "Impossible de modifier une tache housekeeping annulee.";
  }

  return "Impossible de revenir en arriere sur le statut d une tache housekeeping.";
}

export default function HotelHousekeepingPage() {
  const params = useParams<{ business: string }>();
  const business = params?.business ?? "";

  const [rooms, setRooms] = useState<HotelRoom[]>([]);
  const [tasks, setTasks] = useState<HotelHousekeepingTask[]>([]);
  const [employees, setEmployees] = useState<EmployeeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [updatingTaskId, setUpdatingTaskId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [statusDrafts, setStatusDrafts] = useState<Record<number, string>>({});
  const [confirmationDialog, setConfirmationDialog] = useState<HousekeepingStatusConfirmationState | null>(null);
  const [dateFilter, setDateFilter] = useState(formatDateInput(new Date()));

  const [roomId, setRoomId] = useState("");
  const [taskDate, setTaskDate] = useState(formatDateInput(new Date()));
  const [taskType, setTaskType] = useState<HousekeepingTaskType>("cleaning");
  const [priority, setPriority] = useState<"low" | "normal" | "high" | "urgent">("normal");
  const [status, setStatus] = useState<HousekeepingTaskStatus>("pending");
  const [assignedEmployeeId, setAssignedEmployeeId] = useState("");
  const [notes, setNotes] = useState("");

  const eligibleEmployees = useMemo(() => {
    const keywords = getEmployeeKeywordsForTask(taskType);

    return employees.filter((employee) => {
      if (!employee.isActive) return false;
      const jobTitle = normalizeSearchValue(employee.jobTitle);
      return keywords.some((keyword) => jobTitle.includes(keyword));
    });
  }, [employees, taskType]);

  async function loadData() {
    if (!business) return;
    setLoading(true);
    setError("");
    try {
      const [roomsData, taskData, employeeData] = await Promise.all([
        getHotelRooms(business),
        getHotelHousekeepingTasks(business, { all: true, taskDate: dateFilter || undefined }),
        listEmployees(business, { page: 1, perPage: 100, isActive: true }),
      ]);
      setRooms(roomsData);
      setTasks(taskData);
      setEmployees(employeeData.items);
      setStatusDrafts(() => {
        const next: Record<number, string> = {};
        taskData.forEach((task) => {
          next[task.id] = task.status;
        });
        return next;
      });
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, [business, dateFilter]);

  useEffect(() => {
    if (!assignedEmployeeId) return;
    const exists = eligibleEmployees.some((employee) => employee.id === assignedEmployeeId);
    if (!exists) {
      setAssignedEmployeeId("");
    }
  }, [assignedEmployeeId, eligibleEmployees]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!business) return;
    if (!roomId) {
      setError("Selectionne une chambre.");
      return;
    }
    if (!taskDate) {
      setError("Date de tache obligatoire.");
      return;
    }

    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const assignedEmployee = eligibleEmployees.find((employee) => employee.id === assignedEmployeeId) ?? null;
      await createHotelHousekeepingTask(business, {
        roomId: Number(roomId),
        taskDate,
        taskType,
        priority,
        status,
        assignedEmployeeId: assignedEmployee ? Number(assignedEmployee.id) : null,
        assignedTo: assignedEmployee?.name ?? "",
        notes: notes.trim(),
      });
      setRoomId("");
      setTaskDate(formatDateInput(new Date()));
      setTaskType("cleaning");
      setPriority("normal");
      setStatus("pending");
      setAssignedEmployeeId("");
      setNotes("");
      setSuccess("Tache housekeeping ajoutee.");
      await loadData();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(taskId: number) {
    if (!business) return;
    if (!window.confirm("Supprimer cette tache housekeeping ?")) return;
    setError("");
    setSuccess("");
    try {
      await deleteHotelHousekeepingTask(business, taskId);
      setSuccess("Tache housekeeping supprimee.");
      await loadData();
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  function closeConfirmationDialog(resetStatus = true) {
    setConfirmationDialog((current) => {
      if (resetStatus && current) {
        setStatusDrafts((prev) => ({
          ...prev,
          [current.taskId]: current.previousStatus,
        }));
      }
      return null;
    });
  }

  function requestStatusConfirmation(task: HotelHousekeepingTask, nextStatus: string) {
    const previousStatus = (statusDrafts[task.id] ?? task.status) as HousekeepingTaskStatus;
    const normalizedStatus = nextStatus as HousekeepingTaskStatus;
    if (normalizedStatus === previousStatus) return;

    const transitionError = getTaskStatusTransitionError(task, normalizedStatus);
    if (transitionError) {
      setError(transitionError);
      setSuccess("");
      setStatusDrafts((prev) => ({ ...prev, [task.id]: previousStatus }));
      return;
    }

    setStatusDrafts((prev) => ({ ...prev, [task.id]: normalizedStatus }));
    setConfirmationDialog({
      taskId: task.id,
      previousStatus,
      nextStatus: normalizedStatus,
    });
  }

  async function handleStatusSave(taskId: number, previousStatus: HousekeepingTaskStatus, nextStatus: HousekeepingTaskStatus) {
    if (!business) return;

    setUpdatingTaskId(taskId);
    setError("");
    setSuccess("");
    try {
      await updateHotelHousekeepingTask(business, taskId, {
        status: nextStatus,
      });
      setSuccess("Statut housekeeping mis a jour.");
      setConfirmationDialog(null);
      await loadData();
    } catch (err) {
      setStatusDrafts((prev) => ({ ...prev, [taskId]: previousStatus }));
      setError(getErrorMessage(err));
    } finally {
      setUpdatingTaskId(null);
    }
  }

  async function confirmPendingStatusChange() {
    if (!confirmationDialog) return;

    await handleStatusSave(
      confirmationDialog.taskId,
      confirmationDialog.previousStatus,
      confirmationDialog.nextStatus
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-extrabold text-slate-900">Hotel - Housekeeping</h1>
            <p className="mt-1 text-sm text-slate-600">Gestion nettoyage, inspection, maintenance et suivi equipe.</p>
          </div>
          <Link
            href={business ? `/${business}/hotel` : "/"}
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Retour module hotel
          </Link>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4">
        <h2 className="text-lg font-bold text-slate-900">Nouvelle tache housekeeping</h2>
        <div className="grid gap-3 md:grid-cols-3">
          <label className="space-y-1 text-sm">
            <span className="font-semibold text-slate-700">Chambre</span>
            <select
              value={roomId}
              onChange={(event) => setRoomId(event.target.value)}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 focus:border-blue-400 focus:outline-none"
            >
              <option value="">Selectionner</option>
              {rooms.map((room) => (
                <option key={room.id} value={String(room.id)}>
                  {room.name} #{room.room_number}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1 text-sm">
            <span className="font-semibold text-slate-700">Date</span>
            <input
              type="date"
              value={taskDate}
              onChange={(event) => setTaskDate(event.target.value)}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 focus:border-blue-400 focus:outline-none"
            />
          </label>
          <label className="space-y-1 text-sm">
            <span className="font-semibold text-slate-700">Type</span>
            <select
              value={taskType}
              onChange={(event) =>
                setTaskType(event.target.value as HousekeepingTaskType)
              }
              className="w-full rounded-xl border border-slate-300 px-3 py-2 focus:border-blue-400 focus:outline-none"
            >
              <option value="cleaning">Nettoyage</option>
              <option value="inspection">Inspection</option>
              <option value="maintenance">Maintenance</option>
            </select>
          </label>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <label className="space-y-1 text-sm">
            <span className="font-semibold text-slate-700">Priorite</span>
            <select
              value={priority}
              onChange={(event) => setPriority(event.target.value as "low" | "normal" | "high" | "urgent")}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 focus:border-blue-400 focus:outline-none"
            >
              <option value="low">Low</option>
              <option value="normal">Normal</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
          </label>
          <label className="space-y-1 text-sm">
            <span className="font-semibold text-slate-700">Statut</span>
            <select
              value={status}
              onChange={(event) =>
                setStatus(event.target.value as HousekeepingTaskStatus)
              }
              className="w-full rounded-xl border border-slate-300 px-3 py-2 focus:border-blue-400 focus:outline-none"
            >
              <option value="pending">En attente</option>
              <option value="in_progress">En cours</option>
              <option value="done">Terminee</option>
              <option value="cancelled">Annulee</option>
            </select>
          </label>
          <label className="space-y-1 text-sm">
            <span className="font-semibold text-slate-700">Assigne a</span>
            <select
              value={assignedEmployeeId}
              onChange={(event) => setAssignedEmployeeId(event.target.value)}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 focus:border-blue-400 focus:outline-none"
            >
              <option value="">Selectionner un employe</option>
              {eligibleEmployees.map((employee) => (
                <option key={employee.id} value={employee.id}>
                  {employee.name}
                  {employee.jobTitle ? ` - ${employee.jobTitle}` : ""}
                </option>
              ))}
            </select>
            {eligibleEmployees.length === 0 ? (
              <p className="text-xs text-amber-700">
                Aucun employe actif ne correspond au role attendu pour ce type de tache.
              </p>
            ) : null}
          </label>
        </div>

        <label className="space-y-1 text-sm block">
          <span className="font-semibold text-slate-700">Notes</span>
          <input
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            className="w-full rounded-xl border border-slate-300 px-3 py-2 focus:border-blue-400 focus:outline-none"
          />
        </label>

        <button
          type="submit"
          disabled={saving}
          className="rounded-xl bg-[#0d63b8] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0a4d8f] disabled:opacity-60"
        >
          {saving ? "Enregistrement..." : "Ajouter tache"}
        </button>
      </form>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 className="text-lg font-bold text-slate-900">Liste housekeeping</h2>
          <label className="space-y-1 text-sm">
            <span className="font-semibold text-slate-700">Filtrer par date</span>
            <input
              type="date"
              value={dateFilter}
              onChange={(event) => setDateFilter(event.target.value)}
              className="rounded-xl border border-slate-300 px-3 py-2 focus:border-blue-400 focus:outline-none"
            />
          </label>
        </div>

        {error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
        ) : null}
        {success ? (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {success}
          </div>
        ) : null}

        {loading ? (
          <div className="text-sm text-slate-600">Chargement...</div>
        ) : tasks.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 p-4 text-sm text-slate-600">
            Aucune tache housekeeping.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500">
                  <th className="py-2 pr-3">Date</th>
                  <th className="py-2 pr-3">Chambre</th>
                  <th className="py-2 pr-3">Type</th>
                  <th className="py-2 pr-3">Priorite</th>
                  <th className="py-2 pr-3">Assigne</th>
                  <th className="py-2 pr-3">Statut</th>
                  <th className="py-2">Action</th>
                </tr>
              </thead>
              <tbody>
                {tasks.map((task) => (
                  <tr key={task.id} className="border-t border-slate-100">
                    <td className="py-2 pr-3 text-slate-700">{task.task_date || "-"}</td>
                    <td className="py-2 pr-3 text-slate-700">
                      {task.room?.name || "-"} #{task.room?.room_number || "-"}
                    </td>
                    <td className="py-2 pr-3 text-slate-700">{getTaskTypeLabel(task.task_type)}</td>
                    <td className="py-2 pr-3 text-slate-700">{task.priority || "-"}</td>
                    <td className="py-2 pr-3 text-slate-700">
                      {task.assigned_employee?.name || task.assigned_to || "-"}
                    </td>
                    <td className="py-2 pr-3">
                      <select
                        value={statusDrafts[task.id] ?? task.status}
                        onChange={(event) => requestStatusConfirmation(task, event.target.value)}
                        disabled={updatingTaskId === task.id || task.status === "done" || task.status === "cancelled"}
                        className="rounded-lg border border-slate-300 px-2 py-1 text-xs focus:border-blue-400 focus:outline-none disabled:opacity-60"
                      >
                        <option
                          value="pending"
                          disabled={task.status !== "pending"}
                        >
                          En attente
                        </option>
                        <option
                          value="in_progress"
                          disabled={getTaskStatusTransitionError(task, "in_progress") !== null}
                        >
                          En cours
                        </option>
                        <option value="done" disabled={getTaskStatusTransitionError(task, "done") !== null}>
                          Terminee
                        </option>
                        <option
                          value="cancelled"
                          disabled={getTaskStatusTransitionError(task, "cancelled") !== null}
                        >
                          Annulee
                        </option>
                      </select>
                    </td>
                    <td className="py-2">
                      <button
                        type="button"
                        onClick={() => void handleDelete(task.id)}
                        className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50"
                      >
                        Supprimer
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {confirmationDialog ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="housekeeping-status-confirmation-title"
          onClick={() => closeConfirmationDialog()}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <h3 id="housekeeping-status-confirmation-title" className="text-lg font-bold text-slate-900">
              Confirmer le changement de statut
            </h3>
            <p className="mt-2 text-sm text-slate-600">
              Veux-tu vraiment changer le statut de{" "}
              <span className="font-semibold text-slate-900">
                {getTaskStatusLabel(confirmationDialog.previousStatus)}
              </span>{" "}
              vers{" "}
              <span className="font-semibold text-slate-900">
                {getTaskStatusLabel(confirmationDialog.nextStatus)}
              </span>
              ?
            </p>
            <p className="mt-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-700">
              Attention: apres validation, tu ne pourras plus revenir en arriere sur ce statut.
            </p>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => closeConfirmationDialog()}
                className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Non
              </button>
              <button
                type="button"
                onClick={() => void confirmPendingStatusChange()}
                disabled={updatingTaskId === confirmationDialog.taskId}
                className="rounded-xl bg-[#0d63b8] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0a4d8f] disabled:opacity-60"
              >
                {updatingTaskId === confirmationDialog.taskId ? "Validation..." : "Oui, valider"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
