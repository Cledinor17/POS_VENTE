"use client";

import { Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend,
} from "chart.js";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Filler, Tooltip, Legend);

export default function SalesChart() {
  const data = {
    labels: ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"],
    datasets: [
      {
        label: "Ventes ($)",
        data: [450, 700, 620, 950, 1100, 1500, 1200],
        borderColor: "#4f46e5",
        backgroundColor: "rgba(79, 70, 229, 0.1)",
        fill: true,
        tension: 0.4,
        borderWidth: 3,
        pointRadius: 4,
        pointBackgroundColor: "#fff",
        pointBorderColor: "#4f46e5",
      },
    ],
  };

  const options = {
    responsive: true,
    plugins: { legend: { display: false } as const },
    scales: {
      y: { display: false as const },
      x: { grid: { display: false as const } },
    },
  };

  return <Line data={data} options={options} height={200} />;
}
