// Константы для расчёта (можно менять под бизнес-логику)
const FEE_RATE = 0.045;   // 4.5% комиссия сервиса
const FEE_FIXED = 10;     // фиксированная комиссия, ₽
const CURRENCY = "₽";

// Демонстрационные промокоды: % скидки от ИТОГО
const PROMOS = {
  "CLASS10": { type: "percent", value: 10, label: "Скидка 10% для CLASS" },
  "STEAM5":  { type: "percent", value: 5,  label: "Скидка 5% Steam" },
  "VIP150":  { type: "fixed",   value: 150, label: "Минус 150 ₽" }
};

const el = (id) => document.getElementById(id);
const fmt = (n) =>
  isNaN(n) ? "—" : new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 2 }).format(n) + " " + CURRENCY;

const loginInput = el("login");
const amountInput = el("amount");
const promoInput = el("promo");
const promoMsg = el("promo-msg");
const terms = el("terms");
const payBtn = el("pay-btn");

const sumAmount = el("sum-amount");
const feeAmount = el("fee-amount");
const discountAmount = el("discount-amount");
const totalAmount = el("total-amount");
const feeRateLabel = el("fee-rate-label");
const toast = el("toast");

feeRateLabel.textContent = `(${(FEE_RATE * 100).toFixed(1)}% + ${FEE_FIXED} ₽)`;

function getAmount() {
  const v = parseFloat(amountInput.value);
  return isFinite(v) ? v : 0;
}

function getPromoDiscount(totalBeforeDiscount) {
  const code = promoInput.value.trim().toUpperCase();
  if (!code) {
    promoMsg.textContent = "";
    return 0;
  }
  const p = PROMOS[code];
  if (!p) {
    promoMsg.textContent = "Промокод не найден";
    promoMsg.style.color = "var(--danger)";
    return 0;
  }
  promoMsg.textContent = p.label;
  promoMsg.style.color = "var(--success)";
  if (p.type === "percent") {
    return +(totalBeforeDiscount * (p.value / 100)).toFixed(2);
  } else {
    return Math.min(p.value, totalBeforeDiscount);
  }
}

function recalc() {
  const base = getAmount();
  sumAmount.textContent = fmt(base);

  const fee = base > 0 ? +(base * FEE_RATE + FEE_FIXED).toFixed(2) : 0;
  feeAmount.textContent = fmt(fee);

  const totalBeforeDiscount = base + fee;
  const discount = getPromoDiscount(totalBeforeDiscount);
  discountAmount.textContent = discount ? "− " + fmt(discount).replace(" " + CURRENCY, "") + " " + CURRENCY : "—";

  const total = Math.max(0, +(totalBeforeDiscount - discount).toFixed(2));
  totalAmount.textContent = fmt(total);

  // Валидация для кнопки
  const valid =
    loginInput.value.trim().length >= 3 &&
    base >= +amountInput.min &&
    terms.checked;

  payBtn.disabled = !valid;
}

["input", "change", "blur"].forEach(evt => {
  amountInput.addEventListener(evt, recalc);
  loginInput.addEventListener(evt, recalc);
  promoInput.addEventListener(evt, recalc);
  terms.addEventListener(evt, recalc);
});

document.getElementById("topup-form").addEventListener("submit", (e) => {
  e.preventDefault();
  if (payBtn.disabled) return;

  // Здесь — редирект на платёжку/инициация SDK. Пока показываем тост.
  const payload = {
    login: loginInput.value.trim(),
    amount: getAmount(),
    feeRate: FEE_RATE,
    feeFixed: FEE_FIXED,
    promo: promoInput.value.trim().toUpperCase() || null,
    total: totalAmount.textContent
  };

  showToast(`Демо-оплата оформлена для @${payload.login} на ${payload.total}.`);

  // Пример: window.location.href = "/pay?..." — под реальную интеграцию
});

function showToast(message){
  toast.textContent = message;
  toast.hidden = false;
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => { toast.hidden = true; }, 3000);
}

// Первичный рендер
recalc();
