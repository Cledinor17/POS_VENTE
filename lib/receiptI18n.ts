import { DEFAULT_LOCALE, isSupportedLocale, type Locale } from "./locale";

// Printed receipts deliberately use the same six language codes as the app.
// Keep this module independent of React so checkout, reprint and print tests
// can resolve the exact same labels.
export type ReceiptLabels = {
  reprint: string; ticket: string; date: string; cashier: string; payment: string;
  status: string; customer: string; subtotal: string; discount: string; tax: string;
  total: string; paid: string; received: string; change: string; balance: string;
  refunded: string; refund: string; paymentLine: string; cashReceived: string;
  changeGiven: string; pointsPending: string; earnedPoints: string; pointsBalance: string;
  qrPayment: string; qrScan: string; thanks: string; logoAlt: string; qrAlt: string;
  print80: string; printA4: string;
  statuses: Record<string, string>;
  methods: Record<string, string>;
};

export const RECEIPT_LOCALE_TAG: Record<Locale, string> = {
  fr: "fr-FR", en: "en-US", ht: "ht-HT", es: "es-ES",
  zh: "zh-CN", ar: "ar",
};

const dictionary: Record<Locale, ReceiptLabels> = {
  fr: {
    reprint:"RÉIMPRESSION", ticket:"Ticket", date:"Date", cashier:"Caissier", payment:"Paiement",
    status:"Statut", customer:"Client", subtotal:"Sous-total", discount:"Rabais", tax:"Taxes",
    total:"Total", paid:"Montant réglé", received:"Reçu", change:"Monnaie",
    balance:"Solde", refunded:"Remboursé", refund:"Remboursement", paymentLine:"Paiement",
    cashReceived:"Espèces reçues", changeGiven:"Monnaie rendue",
    pointsPending:"Points de fidélité : calcul et solde disponibles après synchronisation.",
    earnedPoints:"Nouveaux points gagnés :", pointsBalance:"Solde total des points :",
    qrPayment:"QR paiement", qrScan:"Scanner pour voir le business, le montant payé et la date.",
    thanks:"Merci et à bientôt.", logoAlt:"Logo du business", qrAlt:"QR du ticket",
    print80:"Imprimer 80 mm", printA4:"Imprimer A4",
    statuses:{paid:"Payée",partially_paid:"Partiellement payée",void:"Annulée",refunded:"Remboursée",issued:"Ouverte"},
    methods:{cash:"Espèces",card:"Carte",mobile_money:"Mobile",moncash:"MonCash",bank_transfer:"Virement",bank:"Virement",voucher:"Bon",cheque:"Chèque",loyalty:"Points fidélité",deposit_applied:"Acompte appliqué"},
  },
  en: {
    reprint:"REPRINT",ticket:"Receipt",date:"Date",cashier:"Cashier",payment:"Payment",
    status:"Status",customer:"Customer",subtotal:"Subtotal",discount:"Discount",tax:"Taxes",
    total:"Total",paid:"Amount paid",received:"Cash received",change:"Change",
    balance:"Balance due",refunded:"Refunded",refund:"Refund",paymentLine:"Payment",
    cashReceived:"Cash received",changeGiven:"Change given",
    pointsPending:"Loyalty points: balance available after syncing.",
    earnedPoints:"Points earned:",pointsBalance:"Total point balance:",
    qrPayment:"PAYMENT QR",qrScan:"Scan to view the business, amount paid and date.",
    thanks:"Thank you and see you soon.",logoAlt:"Business logo",qrAlt:"Receipt QR",
    print80:"Print 80 mm",printA4:"Print A4",
    statuses:{paid:"Paid",partially_paid:"Partially paid",void:"Voided",refunded:"Refunded",issued:"Open"},
    methods:{cash:"Cash",card:"Card",mobile_money:"Mobile money",moncash:"MonCash",bank_transfer:"Bank transfer",bank:"Bank transfer",voucher:"Voucher",cheque:"Cheque",loyalty:"Loyalty points",deposit_applied:"Deposit applied"},
  },
  ht: {
    reprint:"RE-ENPRIME",ticket:"Resi",date:"Dat",cashier:"Kesye",payment:"Peman",
    status:"Estati",customer:"Kliyan",subtotal:"Sou-total",discount:"Rabè",tax:"Taks",
    total:"Total",paid:"Kantite lajan peye",received:"Lajan resevwa",change:"Monnen",
    balance:"Rès pou peye",refunded:"Lajan remèt",refund:"Ranbousman",paymentLine:"Peman",
    cashReceived:"Lajan kach resevwa",changeGiven:"Monnen remèt",
    pointsPending:"Pwen fidelite yo ap disponib apre senkronizasyon.",
    earnedPoints:"Nouvo pwen ou genyen:",pointsBalance:"Total pwen ou genyen:",
    qrPayment:"KÒD QR PEMAN",qrScan:"Eskane pou wè biznis la, montan peye a ak dat la.",
    thanks:"Mèsi, n a wè pita.",logoAlt:"Logo biznis la",qrAlt:"Kòd QR resi a",
    print80:"Enprime 80 mm",printA4:"Enprime A4",
    statuses:{paid:"Peye",partially_paid:"Peye an pati",void:"Anile",refunded:"Ranbouse",issued:"Ouvè"},
    methods:{cash:"Kach",card:"Kat",mobile_money:"Lajan mobil",moncash:"MonCash",bank_transfer:"Transfè labank",bank:"Transfè labank",voucher:"Bon",cheque:"Chèk",loyalty:"Pwen fidelite",deposit_applied:"Depo aplike"},
  },
  es: {
    reprint:"REIMPRESIÓN",ticket:"Recibo",date:"Fecha",cashier:"Cajero",payment:"Pago",
    status:"Estado",customer:"Cliente",subtotal:"Subtotal",discount:"Descuento",tax:"Impuestos",
    total:"Total",paid:"Importe pagado",received:"Efectivo recibido",change:"Cambio",
    balance:"Saldo pendiente",refunded:"Reembolsado",refund:"Reembolso",paymentLine:"Pago",
    cashReceived:"Efectivo recibido",changeGiven:"Cambio entregado",
    pointsPending:"Puntos de fidelidad disponibles después de sincronizar.",
    earnedPoints:"Puntos ganados:",pointsBalance:"Saldo total de puntos:",
    qrPayment:"QR DE PAGO",qrScan:"Escanea para ver el negocio, el importe y la fecha.",
    thanks:"Gracias y hasta pronto.",logoAlt:"Logotipo del negocio",qrAlt:"QR del recibo",
    print80:"Imprimir 80 mm",printA4:"Imprimir A4",
    statuses:{paid:"Pagada",partially_paid:"Parcialmente pagada",void:"Anulada",refunded:"Reembolsada",issued:"Abierta"},
    methods:{cash:"Efectivo",card:"Tarjeta",mobile_money:"Dinero móvil",moncash:"MonCash",bank_transfer:"Transferencia",bank:"Transferencia",voucher:"Vale",cheque:"Cheque",loyalty:"Puntos de fidelidad",deposit_applied:"Anticipo aplicado"},
  },
  zh: {
    reprint:"补打小票",ticket:"小票",date:"日期",cashier:"收银员",payment:"付款方式",
    status:"状态",customer:"客户",subtotal:"小计",discount:"折扣",tax:"税费",
    total:"总计",paid:"已付金额",received:"实收现金",change:"找零",
    balance:"未付余额",refunded:"已退款",refund:"退款",paymentLine:"付款",
    cashReceived:"收到现金",changeGiven:"已找零",
    pointsPending:"积分将在同步后显示。",
    earnedPoints:"本次获得积分：",pointsBalance:"积分总余额：",
    qrPayment:"付款二维码",qrScan:"扫码查看商家、付款金额和日期。",
    thanks:"感谢惠顾，欢迎再来。",logoAlt:"商家标志",qrAlt:"小票二维码",
    print80:"打印 80 毫米",printA4:"打印 A4",
    statuses:{paid:"已支付",partially_paid:"部分支付",void:"已作废",refunded:"已退款",issued:"未结清"},
    methods:{cash:"现金",card:"银行卡",mobile_money:"移动支付",moncash:"MonCash",bank_transfer:"银行转账",bank:"银行转账",voucher:"代金券",cheque:"支票",loyalty:"积分",deposit_applied:"预付款抵扣"},
  },
  ar: {
    reprint:"إعادة طباعة",ticket:"إيصال",date:"التاريخ",cashier:"أمين الصندوق",payment:"الدفع",
    status:"الحالة",customer:"العميل",subtotal:"المجموع الفرعي",discount:"الخصم",tax:"الضرائب",
    total:"الإجمالي",paid:"المبلغ المدفوع",received:"النقد المستلم",change:"الباقي",
    balance:"الرصيد المستحق",refunded:"المبلغ المسترد",refund:"استرداد",paymentLine:"دفعة",
    cashReceived:"النقد المستلم",changeGiven:"الباقي المعاد",
    pointsPending:"تتوفر نقاط الولاء بعد المزامنة.",
    earnedPoints:"النقاط المكتسبة:",pointsBalance:"إجمالي رصيد النقاط:",
    qrPayment:"رمز QR للدفع",qrScan:"امسح لعرض المتجر والمبلغ المدفوع والتاريخ.",
    thanks:"شكرًا لتعاملكم معنا، إلى اللقاء.",logoAlt:"شعار المتجر",qrAlt:"رمز QR للإيصال",
    print80:"طباعة 80 مم",printA4:"طباعة A4",
    statuses:{paid:"مدفوعة",partially_paid:"مدفوعة جزئيًا",void:"ملغاة",refunded:"مستردة",issued:"مفتوحة"},
    methods:{cash:"نقدًا",card:"بطاقة",mobile_money:"دفع عبر الهاتف",moncash:"MonCash",bank_transfer:"تحويل بنكي",bank:"تحويل بنكي",voucher:"قسيمة",cheque:"شيك",loyalty:"نقاط الولاء",deposit_applied:"العربون المحتسب"},
  },
};

export function receiptLocale(input: unknown): Locale {
  return isSupportedLocale(input) ? input : DEFAULT_LOCALE;
}
export function receiptLabels(input: unknown): ReceiptLabels {
  return dictionary[receiptLocale(input)];
}
