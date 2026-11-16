// Legal page content (D-025, run 12): privacy + terms, EN + AR, DRAFT text.
// Covers only what the app really collects today; support address is a placeholder.

export const SUPPORT_EMAIL = "support@momentum.app.placeholder";

export type Lang = "en" | "ar";
export type Section = { h: string; p: string };
export type LegalStrings = {
  title: string;
  subtitle: string;
  updated: string;
  draftBanner: string;
  sections: Section[];
  contactHeading: string;
  contactLine: string;
  footerNote: string;
  backLabel: string;
  langToggle: string;
  draftTag: string;
};

const PRIVACY: Record<Lang, LegalStrings> = {
  en: {
    title: "Privacy Policy",
    subtitle: "How Momentum handles your data",
    updated: "Last updated: 2026-11-16",
    draftBanner: "DRAFT — not lawyer-reviewed. Nothing here creates obligations for you.",
    sections: [
      { h: "What we collect", p: "Momentum stores what you need for shared accountability: your email address and chosen handle; the tasks, projects, and completion records you create; your connections to friends you invite or accept; and a push-notification subscription identifier if you enable notifications. When something breaks, technical error reports are sent to our error-tracking provider. We do not run advertising or analytics trackers." },
      { h: "What we do NOT collect", p: "No advertising identifiers, no analytics or profiling trackers, no location data, and no contacts from your device. We do not sell data." },
      { h: "How your data is used", p: "Your data is used only to run the service for you: showing your tasks and projects, keeping shared projects in sync between you and your friends, delivering sign-in links by email, delivering push notifications you asked for, and diagnosing technical problems." },
      { h: "Email and push messages", p: "We send transactional emails (sign-in links) and push notifications only for features you enabled. A push subscription can be turned off in your browser or in the app; sign-in emails are sent only when you request a link." },
      { h: "AI features", p: "When you use an AI assist feature (for example, generating a project plan or a task description), the text you provide is sent to an AI service only to produce that result. Requests are limited per user per day. We do not use your content to train AI models." },
      { h: "Data retention and deletion", p: "Your data is kept while your account is active. You can delete tasks and projects yourself at any time. Deleting your account removes your data; to request deletion, contact the support address below." },
      { h: "Security", p: "Data is stored in an access-controlled database, and connections are encrypted in transit. No system is perfectly secure, so please avoid storing highly sensitive information in tasks." },
    ],
    contactHeading: "Contact",
    contactLine: "Support (placeholder):",
    footerNote: "This is a DRAFT document, not lawyer-reviewed.",
    backLabel: "Back",
    langToggle: "العربية",
    draftTag: "DRAFT",
  },
  ar: {
    title: "سياسة الخصوصية",
    subtitle: "كيف يتعامل «مومنتم» مع بياناتك",
    updated: "آخر تحديث: ١٦ نوفمبر ٢٠٢٦",
    draftBanner: "مسودة — لم يراجعها محامٍ. لا يُنشئ أي نص هنا التزامات عليك.",
    sections: [
      { h: "ما نجمعه", p: "يخزّن «مومنتم» ما يلزم للمسؤولية المشتركة: بريدك الإلكتروني واسم المستخدم الذي تختاره؛ المهام والمشاريع وسجلات الإنجاز التي تنشئها؛ ارتباطاتك بالأصدقاء الذين تدعوهم أو تقبل دعوتهم؛ ومعرّف اشتراك الإشعارات إذا فعّلت الإشعارات. عند حدوث عطل تقني، تُرسل تقارير الأخطاء إلى مزوّد تتبع الأخطاء لدينا. لا نُشغّل إعلانات أو أدوات تتبع تحليلية." },
      { h: "ما لا نجمعه", p: "لا نجمع معرّفات إعلانية أو أدوات تحليل أو تتبع للملفات الشخصية أو بيانات الموقع الجغرافي أو جهات اتصال جهازك. لا نبيع البيانات." },
      { h: "كيف تُستخدم بياناتك", p: "تُستخدم بياناتك لتشغيل الخدمة لك فقط: عرض مهامك ومشاريعك، ومزامنة المشاريع المشتركة بينك وبين أصدقائك، وإرسال روابط الدخول بالبريد، وتسليم الإشعارات التي طلبتها، وتشخيص الأعطال التقنية." },
      { h: "البريد والإشعارات", p: "نرسل رسائل بريد ضرورية (روابط الدخول) وإشعارات فورية فقط للميزات التي فعّلتها. يمكنك إيقاف اشتراك الإشعارات من متصفحك أو من التطبيق؛ ولا تُرسل رسائل الدخول إلا عند طلبك رابطًا." },
      { h: "ميزات الذكاء الاصطناعي", p: "عند استخدام ميزة ذكاء اصطناعي (مثل توليد خطة مشروع أو وصف مهمة)، يُرسل النص الذي تقدمه إلى خدمة ذكاء اصطناعي فقط لإنتاج تلك النتيجة. الطلبات محدودة لكل مستخدم يوميًا. لا نستخدم محتواك لتدريب نماذج الذكاء الاصطناعي." },
      { h: "الاحتفاظ بالبيانات وحذفها", p: "تبقى بياناتك محفوظة أثناء نشاط حسابك. يمكنك حذف المهام والمشاريع بنفسك في أي وقت. حذف الحساب يحذف بياناتك؛ لطلب الحذف راسلنا على عنوان الدعم أدناه." },
      { h: "الأمان", p: "تُخزّن البيانات في قاعدة بيانات محكومة بالصلاحيات، ويُمشّف الاتصال أثناء النقل. لا يوجد نظام آمن تمامًا، لذا نرجو ألا تخزّن معلومات شديدة الحساسية داخل المهام." },
    ],
    contactHeading: "التواصل",
    contactLine: "الدعم (مؤقت):",
    footerNote: "هذه الوثيقة مسودة ولم يراجعها محامٍ.",
    backLabel: "رجوع",
    langToggle: "English",
    draftTag: "مسودة",
  },
};

const TERMS: Record<Lang, LegalStrings> = {
  en: {
    title: "Terms of Service",
    subtitle: "The rules for using Momentum",
    updated: "Last updated: 2026-11-16",
    draftBanner: "DRAFT — not lawyer-reviewed. Nothing here creates obligations for you.",
    sections: [
      { h: "The service", p: "Momentum is a collaborative task and habit tracker: friends co-own tasks, keep streaks, and hold each other accountable. The service is provided as is, in draft-launch state, and may change or pause while it is being finished." },
      { h: "Your account", p: "You sign in with a magic link to your email — there is no password. You are responsible for access to your inbox and for the content you create. One handle per person; do not impersonate others." },
      { h: "Acceptable use", p: "Do not use Momentum to harass anyone, to share unlawful content, to spam invitations, or to break the service for others. Shared projects are visible to the friends you invite — invite only people you trust." },
      { h: "Shared content", p: "Tasks and projects you share are visible to the friends in that project. You keep responsibility for what you share; deleting content removes it for everyone in the project." },
      { h: "AI features", p: "AI assist (project and description generation) is optional and limited per user per day. AI output can be wrong — review it before relying on it. AI features may pause when daily limits are reached." },
      { h: "Availability and limits", p: "The service may have downtime, changing features, and daily AI limits. Premium features, when introduced, will show their terms before any purchase." },
      { h: "Ending the service relationship", p: "You can stop using Momentum at any time and request deletion of your data via the support address. We may suspend accounts that break these rules." },
    ],
    contactHeading: "Contact",
    contactLine: "Support (placeholder):",
    footerNote: "This is a DRAFT document, not lawyer-reviewed.",
    backLabel: "Back",
    langToggle: "العربية",
    draftTag: "DRAFT",
  },
  ar: {
    title: "شروط الاستخدام",
    subtitle: "قواعد استخدام «مومنتم»",
    updated: "آخر تحديث: ١٦ نوفمبر ٢٠٢٦",
    draftBanner: "مسودة — لم يراجعها محامٍ. لا يُنشئ أي نص هنا التزامات عليك.",
    sections: [
      { h: "الخدمة", p: "«مومنتم» متتبع مهام وعادات تعاوني: يتقاسم الأصدقاء ملكية المهام، ويحافظون على سلاسل الإنجاز، ويحاسب بعضهم بعضًا. تُقدَّم الخدمة كما هي في حالة الإطلاق التجريبي، وقد تتغير أو تتوقف أثناء إكمالها." },
      { h: "حسابك", p: "تدخل برابط سحري يُرسل إلى بريدك الإلكتروني — لا توجد كلمة مرور. أنت مسؤول عن الوصول إلى بريدك وعن المحتوى الذي تنشئه. اسم مستخدم واحد لكل شخص؛ ولا تنتحل هوية الآخرين." },
      { h: "الاستخدام المقبول", p: "لا تستخدم «مومنتم» لمضايقة أحد أو نشر محتوى غير قانوني أو إغراق الآخرين بالدعوات أو تعطيل الخدمة. المشاريع المشتركة يراها الأصدقاء الذين تدعوهم — ادعُ من تثق بهم فقط." },
      { h: "المحتوى المشترك", p: "المهام والمشاريع التي تشاركها يراها الأصدقاء في ذلك المشروع. تبقى مسؤولًا عما تشاركه؛ وحذف المحتوى يحذفه للجميع في المشروع." },
      { h: "ميزات الذكاء الاصطناعي", p: "المساعدة بالذكاء الاصطناعي (توليد المشاريع والأوصاف) اختيارية ومحدودة لكل مستخدم يوميًا. قد يكون ناتج الذكاء الاصطناعي خاطئًا — راجعه قبل الاعتماد عليه. قد تتوقف الميزات عند بلوغ الحد اليومي." },
      { h: "التوفر والحدود", p: "قد تتوقف الخدمة أو تتغير ميزاتها، وللميزات الذكية حدود يومية. الميزات المميزة، عند طرحها، ستُعرض شروطها قبل أي شراء." },
      { h: "إنهاء العلاقة مع الخدمة", p: "يمكنك التوقف عن استخدام «مومنتم» في أي وقت وطلب حذف بياناتك عبر عنوان الدعم. يجوز لنا إيقاف الحسابات المخالفة." },
    ],
    contactHeading: "التواصل",
    contactLine: "الدعم (مؤقت):",
    footerNote: "هذه الوثيقة مسودة ولم يراجعها محامٍ.",
    backLabel: "رجوع",
    langToggle: "English",
    draftTag: "مسودة",
  },
};

export const LEGAL_DOCS: Record<"privacy" | "terms", Record<Lang, LegalStrings>> = {
  privacy: PRIVACY,
  terms: TERMS,
};
