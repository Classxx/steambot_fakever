// ===== Константы расчёта / отображения =====
const FEE_RATE = 0.045;     // 4.5% комиссия сервиса (на оплату)
const FEE_FIXED = 10;       // фиксированная комиссия (₽)
const PAY_CURRENCY = "₽";   // валюта оплаты и комиссий

// Валюта зачисления зависит от региона (только знак/символ, без конвертации)
const CREDIT_CURRENCY_BY_REGION = { RU: "₽", KZ: "₸", CIS: "$" };

// Промокоды (регистр не важен). TEST — 10%
const PROMOS = {
  "CLASS10": { type: "percent", value: 10, label: "Скидка 10% для CLASS" },
  "STEAM5":  { type: "percent", value: 5,  label: "Скидка 5% Steam" },
  "VIP150":  { type: "fixed",   value: 150, label: "Минус 150 ₽" },
  "TEST":    { type: "percent", value: 10,  label: "Тестовая скидка 10%" }
};

// ===== Telegram WebApp (безопасно для GitHub Pages) =====
const tg = window.Telegram && window.Telegram.WebApp ? window.Telegram.WebApp : null;
if (tg) {
  tg.ready();
  // Небольшая подстройка под тему Telegram
  if (tg.backgroundColor) document.body.style.backgroundColor = tg.backgroundColor;
}

// ===== Утилиты =====
const $ = (id) => document.getElementById(id);

const fmtPay = (n) =>
  isNaN(n) ? "—" : new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 2 }).format(n) + " " + PAY_CURRENCY;

function getRegion() {
  const checked = document.querySelector('#region-group input[type="radio"]:checked');
  return checked ? checked.value : "";
}
function creditSymbol() {
  return CREDIT_CURRENCY_BY_REGION[getRegion() || "RU"] || "₽";
}
function fmtCreditApprox(n) {
  // «≈» — чтобы показать возможное колебание 2–3%
  return isNaN(n) ? "—" :
    "≈ " + new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 2 }).format(n) + " " + creditSymbol();
}

// ===== DOM элементы =====
const loginInput = $("login");
const amountInput = $("amount");
const promoInput  = $("promo");
const promoMsg    = $("promo-msg");
const terms       = $("terms");
const payBtn      = $("pay-btn");

const sumAmount      = $("sum-amount");
const feeAmount      = $("fee-amount");
const discountAmount = $("discount-amount");
const totalAmount    = $("total-amount");
const feeRateLabel   = $("fee-rate-label");
const toast          = $("toast");
const regionGroup    = $("region-group");

// Пояснение к комиссии (в ₽)
feeRateLabel.textContent = `(${(FEE_RATE * 100).toFixed(1)}% + ${FEE_FIXED} ₽)`;

// ===== Логика промокода =====
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

// ===== Пересчёт =====
function getAmount() {
  const v = parseFloat(amountInput.value);
  return isFinite(v) ? v : 0;
}

function recalc() {
  const base = getAmount();

  // Сумма к зачислению — в валюте региона, с «≈»
  sumAmount.textContent = fmtCreditApprox(base);

  // Комиссия и итог — в ₽
  const fee = base > 0 ? +(base * FEE_RATE + FEE_FIXED).toFixed(2) : 0;
  feeAmount.textContent = fmtPay(fee);

  const totalBeforeDiscount = base + fee;
  const discount = getPromoDiscount(totalBeforeDiscount);
  discountAmount.textContent = discount ? "− " + fmtPay(discount).replace(" " + PAY_CURRENCY, "") + " " + PAY_CURRENCY : "—";

  const total = Math.max(0, +(totalBeforeDiscount - discount).toFixed(2));
  totalAmount.textContent = fmtPay(total);

  // Валидация
  const valid =
    loginInput.value.trim().length >= 3 &&
    getRegion() &&
    base >= +amountInput.min &&
    terms.checked;

  payBtn.disabled = !valid;
}

// ===== События =====
["input","change","blur"].forEach(evt => {
  amountInput.addEventListener(evt, recalc);
  loginInput.addEventListener(evt, recalc);
  promoInput.addEventListener(evt, recalc);
  regionGroup.addEventListener(evt, recalc);
  terms.addEventListener(evt, recalc);
});

document.getElementById("topup-form").addEventListener("submit", (e) => {
  e.preventDefault();
  if (payBtn.disabled) return;

  const payload = {
    login:  loginInput.value.trim(),
    region: getRegion(),                 // RU | KZ | CIS
    creditCurrency: creditSymbol(),      // ₽ | ₸ | $
    amount: getAmount(),                 // введённая сумма (условная базовая)
    feeRate: FEE_RATE,
    feeFixed: FEE_FIXED,
    promo:  (promoInput.value.trim() || null),
    totalPay: totalAmount.textContent,   // Итого к оплате (₽)
    creditApprox: sumAmount.textContent  // ≈ сумма к зачислению (валюта региона)
  };

  if (tg) {
    try {
      tg.sendData(JSON.stringify(payload)); // бот получит web_app_data
      tg.showAlert("Заявка отправлена. Проверьте чат с ботом.");
    } catch (err) {
      showToast("Не удалось отправить в Telegram.");
    }
  } else {
    showToast(`Оплата для @${payload.login} (${payload.region}) на ${payload.totalPay}.`);
  }
});

// ===== Тост =====
function showToast(message){
  toast.textContent = message;
  toast.hidden = false;
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => { toast.hidden = true; }, 3000);
}

// ===== Инициализация =====
const ruRadio = document.getElementById("reg-ru");
if (ruRadio) ruRadio.checked = true; // дефолт: Россия
recalc();
