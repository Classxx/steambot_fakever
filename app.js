// ===== Константы расчёта / отображения =====
const FEE_RATE = 0.045;     // 4.5% комиссия сервиса (на оплату)
const FEE_FIXED = 10;       // фиксированная комиссия (₽)
const PAY_CURRENCY = "₽";   // валюта оплаты и комиссий

// Валюта зачисления зависит от региона
const CREDIT_CURRENCY_BY_REGION = { RU: "₽", KZ: "₸", CIS: "$" };

// Курсы (хардкод)
const RATE_RUB_TO_KZT = 6.73;  // 1 ₽ = 6.73 ₸
const RATE_RUB_PER_USD = 82;   // 1 $ = 82 ₽  => $ = ₽ / 82

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

// Конвертация ₽ -> (₽/₸/$) для "Суммы к зачислению"
function convertCreditAmount(rubAmount) {
  const region = getRegion() || "RU";
  if (!isFinite(rubAmount) || rubAmount <= 0) return 0;

  switch (region) {
    case "KZ":
      return rubAmount * RATE_RUB_TO_KZT;         // ₽ -> ₸
    case "CIS":
      return rubAmount / RATE_RUB_PER_USD;        // ₽ -> $
    case "RU":
    default:
      return rubAmount;                            // ₽ -> ₽
  }
}

// «≈» — чтобы указать возможное колебание 2–3%
function fmtCreditApprox(n, symbol) {
  if (isNaN(n)) return "—";
  // Для чистоты отображения округлим до 2 знаков
  const formatted = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 2 }).format(n);
  return `≈ ${formatted} ${symbol}`;
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
  const baseRub = getAmount();

  // Сумма к зачислению — в валюте региона по курсу
  const credit = convertCreditAmount(baseRub);
  sumAmount.textContent = fmtCreditApprox(credit, creditSymbol());

  // Комиссия и итог — в ₽
  const fee = baseRub > 0 ? +(baseRub * FEE_RATE + FEE_FIXED).toFixed(2) : 0;
  feeAmount.textContent = fmtPay(fee);

  const totalBeforeDiscount = baseRub + fee;
  const discount = getPromoDiscount(totalBeforeDiscount);
  discountAmount.textContent = discount ? "− " + fmtPay(discount).replace(" " + PAY_CURRENCY, "") + " " + PAY_CURRENCY : "—";

  const total = Math.max(0, +(totalBeforeDiscount - discount).toFixed(2));
  totalAmount.textContent = fmtPay(total);

  // Валидация
  const valid =
    loginInput.value.trim().length >= 3 &&
    getRegion() &&
    baseRub >= +amountInput.min &&
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

  const baseRub = getAmount();
  const payload = {
    login:  loginInput.value.trim(),
    region: getRegion(),                     // RU | KZ | CIS
    creditCurrency: creditSymbol(),          // ₽ | ₸ | $
    amountRub: baseRub,                      // введённая сумма (в ₽)
    creditByRate: convertCreditAmount(baseRub), // пересчитанная сумма к зачислению (в валюте региона)
    feeRate: FEE_RATE,
    feeFixed: FEE_FIXED,
    promo:  (promoInput.value.trim() || null),
    totalPayRub: +(baseRub + (baseRub * FEE_RATE + FEE_FIXED) - getPromoDiscount(baseRub + (baseRub * FEE_RATE + FEE_FIXED))).toFixed(2)
  };

  if (tg) {
    try {
      tg.sendData(JSON.stringify(payload)); // бот получит web_app_data
      tg.showAlert("Заявка отправлена. Проверьте чат с ботом.");
    } catch (err) {
      showToast("Не удалось отправить в Telegram.");
    }
  } else {
    showToast(`Оплата для @${payload.login} (${payload.region}) на ${fmtPay(payload.totalPayRub)}.`);
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

// ===== Фикс: закрытие клавиатуры при тапе вне полей =====
document.addEventListener('touchend', (e) => {
  const isInput = e.target.closest('input, textarea, select');
  if (!isInput) {
    // снимаем фокус со всех инпутов
    document.activeElement?.blur();
    // иногда помогает принудительный скролл (iOS Safari bug)
    setTimeout(() => window.scrollTo(0, 0), 50);
  }
});


recalc();

