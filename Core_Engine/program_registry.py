# برامج المدرسة من TEMPLATES. القالب يملأ النموذج؛ ensure يزرع الناقص في school_programs.

import json

from .database import _ensure_owner_roles_columns, connect
from .noor_import import stamp

PHRASE_FIELDS = ("mechanism", "success_indicator", "risk_management")

REGISTERS = (
    (1, "سجل القيادة والتحسين المستمر"),
    (2, "سجل التطوير المهني"),
    (3, "سجل المناهج والتقويم"),
    (4, "سجل الانضباط"),
    (5, "سجل الأنشطة والرعاية"),
    (6, "سجل البيئة والموارد"),
)
OWNERS = (
    ("principal", "مدير المدرسة"),
    ("vice_teachers", "وكيل الشؤون التعليمية"),
    ("vice_students", "وكيل شؤون الطلاب"),
    ("student_counselor", "الموجه الطلابي"),
    ("activity_leader", "رائد النشاط"),
    ("teacher", "المعلم"),
    ("vice_admin", "وكيل الشؤون المدرسية"),
    ("health_counselor", "الموجه الصحي"),
    ("librarian", "أمين مصادر التعلم"),
    ("lab_tech", "محضر المختبر"),
    ("admin_assistant", "المساعد الإداري"),
    ("safety_supervisor", "مشرف الأمن والسلامة"),
    ("educational_supervisor", "الموجه التعليمي"),
    ("gifted_coordinator", "منسق موهوبين"),
)
STATUSES = ("مسودة", "معتمد", "قيد التنفيذ", "مكتمل", "متعثر")
UNITS = ("", "%", "عدد", "نسبة")
SLIDE_STATUSES = ("معتمد", "قيد التنفيذ", "مكتمل", "متعثر")
REGISTER_LABELS = dict(REGISTERS)
OWNER_LABELS = dict(OWNERS)
_DOMAIN_ALIAS = {
    "المجتمع المدرسي": "الإدارة المدرسية",
}
_AUDIENCE_BY_ROLE = {
    "principal": "مجتمع المدرسة وأولياء الأمور",
    "vice_teachers": "المعلمون والطلاب في الشؤون التعليمية",
    "vice_students": "جميع طلاب المدرسة",
    "student_counselor": "الطلاب المستهدفون بخدمات التوجيه الطلابي",
    "activity_leader": "طلاب المدرسة المشاركون في الأنشطة",
    "teacher": "الطلاب المستهدفون في الصفوف المسندة للمعلم",
    "vice_admin": "منسوبو المدرسة",
    "health_counselor": "الطلاب المستهدفون بالخدمات الصحية",
    "librarian": "طلاب المدرسة المستفيدون من مصادر التعلم",
    "lab_tech": "طلاب العلوم المستفيدون من المعامل",
    "admin_assistant": "منسوبو المدرسة والمستفيدون من الخدمات الإدارية",
    "safety_supervisor": "منسوبو المدرسة والطلاب في نطاق الأمن والسلامة",
    "educational_supervisor": "المعلمون والطلاب في الإشراف التعليمي",
}

_LOSS_MECHANISM = (
    "1. تطبيق اختبار تشخيصي قبلي وتحديد الفجوة وتوثيقها بنموذج (ت-1).\n"
    "2. بناء خطة التحسين واستمارة البناء لواقع الفصول بنموذج (ت-2).\n"
    "3. تنفيذ مراجعات تدريسية مركزة في الدقائق العشر الأولى من كل حصة لمهارات نافس الحرجة بنموذج (ت-3).\n"
    "4. إجراء اختبار محاكاة بعدي لقياس الأثر وتوثيق الشواهد في سجل المناهج والتقويم."
)
_DISCIPLINE_MECHANISM = (
    "1. رصد الغياب في الحصة الأولى يومياً وإدخاله في نور ونموذج الرصد (ط-1) قبل الساعة التاسعة صباحاً.\n"
    "2. إرسال رسائل لولي الأمر وتحديث سجل تتبع المواظبة أسبوعياً.\n"
    "3. تحويل الحالات التي تتجاوز غياب 5% للموجه الطلابي لدراسة الحالة بنموذج (ط-2) وتوقيع عقد شراكة سلوكية.\n"
    "4. تكريم الفصول ذات الغياب الصفري أسبوعياً وتوثيق الشواهد في سجل الانضباط."
)
_CAREER_MECHANISM = (
    "1. تطبيق مقياس ميول مهنية لطلاب الثالث متوسط وتوثيق النتائج في سجل التوجيه.\n"
    "2. جلسات إرشاد فردية وجماعية حول مسارات الثانوية (عام / مقررات / مهني) وفق نتائج المقياس.\n"
    "3. لقاء أولياء أمور الصف الثالث لشرح المسارات ومتطلبات القبول.\n"
    "4. زيارة افتراضية أو ميدانية لمؤسسة تعليمية/مهنية محلية وتوثيق الأثر باستمارة رضا."
)
_GIFTED_MECHANISM = (
    "1. ترشيح المعلمين وفق محكات الموهبة المعتمدة وحصر المرشحين في سجل رعاية الموهوبين.\n"
    "2. إثراء أسبوعي (بحث / مشروع / مسابقة) داخل الصف وخارجه مع معلم المادة.\n"
    "3. مشاركة الطلاب المرشحين في برامج موهبة أو مسابقات الوزارة حسب المتاح.\n"
    "4. تقويم فصلي لمستوى الإنجاز وتحديث خطة الرعاية في السجل."
)
_PARTNERSHIP_MECHANISM = (
    "1. حصر احتياجات التعلم والشراكات المطلوبة وربطها بهدف G7 في الخطة التشغيلية.\n"
    "2. توقيع 3–5 شراكات محلية مكتوبة (أسرة، مركز صحي، مكتبة، بلدية أو كلية) بهدف تعليمي واضح.\n"
    "3. تنفيذ لقاءات مجلس أولياء الأمور وبرامج ارتقاء وفق التقويم المعتمد.\n"
    "4. قياس الأثر فصلياً (حضور، مستفيدون، أثر على التعلم/السلوك) ورفع تقرير للجنة الإدارية."
)
_SAFETY_MECHANISM = (
    "1. فحص دوري لمتطلبات الأمن والسلامة في الفصول والمعامل والمرافق وتوثيقه في سجل البيئة.\n"
    "2. تنفيذ فرضيات إخلاء مجدولة (ثلاث سنوياً على الأقل) مع محضر فريق الأمن والسلامة.\n"
    "3. جدولة صيانة دورية للمرافق والتجهيزات ورفع نواقص الاشتراطات بخطاب رسمي.\n"
    "4. حملات توعية للطلاب والمنسوبين وقياس رضا فصلي عن البيئة المدرسية."
)

TEMPLATES = (
    {
        "key": "loss",
        "label": "معالجة الفاقد",
        "program_name": "معالجة الفاقد التعليمي والرفع التحصيلي",
        "strategic_goal": "رفع مستوى التحصيل العلمي للطلاب وتحسين نتائجهم في الاختبارات الوطنية (نافس).",
        "goal_ref": "G3",
        "domain": "نواتج التعلم",
        "level_name": "انطلاق",
        "executive_goal": "ردم الفجوة التعليمية وتتبع مهارات نافس الحرجة في القراءة والرياضيات والعلوم.",
        "target_audience": "الطلاب الحاصلون على تقدير دون المتوسط في الاختبارات التشخيصية",
        "duration": "الأسابيع الستة الأولى من الفصل الدراسي",
        "implementers": "معلمو المواد المستهدفة تحت إشراف وكيل الشؤون التعليمية",
        "budget": "ذاتية، بالاعتماد على المصادر الرقمية لوزارة التعليم",
        "mechanism": _LOSS_MECHANISM,
        "success_indicator": "انتقال 80% من الطلاب المستهدفين إلى مستوى متوسط فأعلى",
        "risk_management": "في حال غياب الطالب تُفعَّل الموديولات العلاجية الرقمية عبر منصة مدرستي وتُرسل لولي الأمر",
        "register_id": 3,
        "owner_role": "vice_teachers",
        "indicator_codes": ["3-1-1-1", "3-1-1-2"],
        "baseline_value": "18.8",
        "target_value": "80",
        "unit": "%",
        "kpi_description": "نسبة إتقان الطلاب في الاختبارات الوطنية",
    },
    {
        "key": "discipline",
        "label": "الانضباط",
        "program_name": "تعزيز الانضباط المدرسي والحد من الغياب",
        "strategic_goal": "تعزيز السلوك الإيجابي والصحة النفسية والجسدية للطلاب.",
        "goal_ref": "G5",
        "domain": "نواتج التعلم",
        "level_name": "تقدم",
        "executive_goal": "خفض نسبة الغياب غير المبرر وتعزيز الالتزام بقواعد السلوك والمواظبة",
        "target_audience": "جميع طلاب المدرسة (مع تركيز على متكرري الغياب)",
        "duration": "مستمر طوال العام الدراسي",
        "implementers": "وكيل شؤون الطلاب، الموجه الطلابي، رواد الفصول",
        "budget": "500 ريال للجوائز العينية وشهادات التقدير للفصول المتميزة",
        "mechanism": _DISCIPLINE_MECHANISM,
        "success_indicator": "تحقيق نسبة انضباط عامة لا تقل عن 96% طوال العام الدراسي",
        "risk_management": "عدم تجاوب ولي الأمر يرتب عليه تطبيق لائحة قواعد السلوك والمواظبة وتصعيد الإجراء",
        "register_id": 4,
        "owner_role": "vice_students",
        "owner_roles": ["vice_students", "student_counselor"],
        "indicator_codes": ["3-2-1-5", "1-2-1-4"],
        "baseline_value": "90",
        "target_value": "96",
        "unit": "%",
        "kpi_description": "نسبة الانضباط والمواظبة العامة",
    },
    {
        "key": "career",
        "label": "التوجيه المهني",
        "program_name": "التوجيه المهني والتعليمي",
        "strategic_goal": "تعزيز السلوك الإيجابي والصحة النفسية والجسدية للطلاب.",
        "goal_ref": "G5",
        "domain": "نواتج التعلم",
        "level_name": "تقدم",
        "executive_goal": "تمكين طلاب الثالث متوسط من اختيار مسار ثانوي مناسب وفق الميول والقدرات",
        "target_audience": "طلاب الصف الثالث المتوسط",
        "duration": "الفصل الدراسي الثاني",
        "implementers": "الموجه الطلابي بالتنسيق مع وكيل شؤون الطلاب ورواد الفصول",
        "budget": "ذاتية (مقاييس ميول مطبوعة / مواد توعية)",
        "mechanism": _CAREER_MECHANISM,
        "success_indicator": "إكمال 100% من طلاب الثالث متوسط لمقياس الميول وجلسة توجيه واحدة على الأقل",
        "risk_management": "ضعف حضور أولياء الأمور يُعوَّض برسالة فردية ومحتوى رقمي عبر منصة مدرستي",
        "register_id": 5,
        "owner_role": "student_counselor",
        "owner_roles": ["student_counselor", "vice_students"],
        "indicator_codes": ["3-2-1-6", "1-3-1-2"],
        "baseline_value": "40",
        "target_value": "100",
        "unit": "%",
        "kpi_description": "نسبة طلاب الثالث متوسط المستكملين لبرنامج التوجيه المهني",
    },
    {
        "key": "gifted",
        "label": "رعاية الموهوبين",
        "program_name": "رعاية الموهوبين والمبتكرين",
        "strategic_goal": "رفع مستوى التحصيل العلمي للطلاب وتحسين نتائجهم في الاختبارات الوطنية (نافس).",
        "goal_ref": "G3",
        "domain": "التعليم والتعلم",
        "level_name": "انطلاق",
        "executive_goal": "اكتشاف الموهوبين وتوفير فرص إثراء عادلة تدعم الابتكار والتفوق",
        "target_audience": "الطلاب الموهوبون",
        "duration": "مستمر طوال العام الدراسي",
        "implementers": "رائد النشاط، معلمو المواد، الموجه الطلابي تحت إشراف وكيل الشؤون التعليمية",
        "budget": "من ميزانية النشاط وبرامج موهبة المتاحة",
        "mechanism": _GIFTED_MECHANISM,
        "success_indicator": "خطة رعاية موثّقة لـ 100% من المرشحين ومشاركة 70% منهم في نشاط إثرائي فصلي على الأقل",
        "risk_management": "نقص المقاعد في برامج موهبة يُعوَّض بإثراء داخلي ومسابقات مدرسية موثّقة",
        "register_id": 5,
        "owner_role": "activity_leader",
        "owner_roles": ["activity_leader"],
        "indicator_codes": ["1-2-1-5", "2-1-1-1"],
        "baseline_value": "10",
        "target_value": "20",
        "unit": "%",
        "kpi_description": "نسبة الطلاب المستفيدين من برامج رعاية الموهبة والإثراء",
    },
    {
        "key": "partnership",
        "label": "الشراكة المجتمعية",
        "program_name": "الشراكة المجتمعية لدعم التعلم",
        "strategic_goal": "تعزيز الشراكة المجتمعية مع أولياء الأمور والمؤسسات المحلية.",
        "goal_ref": "G7",
        "domain": "الإدارة المدرسية",
        "level_name": "تهيئة",
        "executive_goal": "بناء شراكات فاعلة تدعم التعلم والعمل التطوعي والتأثير الإيجابي في المجتمع المحلي",
        "target_audience": "أولياء الأمور، المجتمع المحلي",
        "duration": "مستمر طوال العام الدراسي",
        "implementers": "مدير المدرسة، رائد النشاط، مجلس أولياء الأمور",
        "budget": "ذاتية / دعم الشركاء وفق الاتفاقيات",
        "mechanism": _PARTNERSHIP_MECHANISM,
        "success_indicator": "تحقيق 5 شراكات فاعلة سنوياً وحضور أولياء أمور لا يقل عن 70% في اللقاءات المعتمدة",
        "risk_management": "تأخر توقيع الشراكة يُعالَج ببدائل مجتمعية موثّقة وخطة تواصل أسبوعية مع الأسر",
        "register_id": 5,
        "owner_role": "principal",
        "owner_roles": ["principal", "activity_leader"],
        "indicator_codes": ["1-3-1-3", "3-2-1-4"],
        "baseline_value": "2",
        "target_value": "5",
        "unit": "عدد",
        "kpi_description": "عدد الشراكات المجتمعية الفاعلة خلال العام",
    },
    {
        "key": "safety",
        "label": "الأمن والسلامة",
        "program_name": "الأمن والسلامة المدرسية",
        "strategic_goal": "توفير بيئة مدرسية آمنة وصحية محفزة على التعلم وفق معايير الأمن والسلامة.",
        "goal_ref": "G4",
        "domain": "البيئة المدرسية",
        "level_name": "انطلاق",
        "executive_goal": "استيفاء متطلبات الأمن والسلامة وتنفيذ فرضيات الإخلاء وصيانة المرافق بانتظام",
        "target_audience": "جميع المنسوبين والطلاب",
        "duration": "مستمر طوال العام الدراسي",
        "implementers": "وكيل شؤون الطلاب، فريق الأمن والسلامة، محضر المختبر",
        "budget": "صيانة وتشغيل وفق بنود المدرسة وطلبات الإدارة",
        "mechanism": _SAFETY_MECHANISM,
        "success_indicator": "تنفيذ 100% من فرضيات الإخلاء المجدولة ورفع نواقص السلامة بمحاضر رسمية",
        "risk_management": "تأخر استجابة جهات الصيانة يُوثَّق رسمياً مع إجراءات مؤقتة للسلامة داخل المبنى",
        "register_id": 6,
        "owner_role": "vice_students",
        "owner_roles": ["vice_students", "principal"],
        "indicator_codes": ["4-2-1-1", "4-2-1-2", "4-2-1-3"],
        "baseline_value": "60.5",
        "target_value": "75",
        "unit": "%",
        "kpi_description": "نسبة تحقق متطلبات الأمن والسلامة ورضا البيئة المدرسية",
    },
    {
        "key": "nafs",
        "label": "نافس",
        "program_name": "نافس للاستعداد للاختبارات الوطنية",
        "strategic_goal": "رفع مستوى التحصيل العلمي للطلاب وتحسين نتائجهم في الاختبارات الوطنية (نافس).",
        "goal_ref": "G3",
        "domain": "نواتج التعلم",
        "level_name": "انطلاق",
        "executive_goal": "تهيئة الطلاب لاختبارات نافس عبر محاكاة وتمارين مهارات مستهدفة",
        "target_audience": "طلاب الصفوف المستهدفة في نافس",
        "duration": "قبل نافس وخلال فترات المراجعة المعتمدة",
        "implementers": "وكيل الشؤون التعليمية ومعلمو القراءة والرياضيات والعلوم",
        "budget": "ذاتية / منصة مدرستي ونماذج الوزارة",
        "mechanism": "1. تحليل نتائج نافس السابقة وتحديد المهارات الأضعف.\n2. جدول مراجعة أسبوعي للمهارات الحرجة.\n3. اختبارات محاكاة موثّقة مع تغذية راجعة.\n4. تقرير أثر بعد كل محاكاة في سجل المناهج والتقويم.",
        "success_indicator": "تحسن متوسط المدرسة في نافس بنسبة لا تقل عن 10% عن العام السابق",
        "risk_management": "ضعف حضور الطلاب للمراجعات يُعوَّض بواجبات رقمية ومتابعة ولي الأمر",
        "register_id": 3,
        "owner_role": "vice_teachers",
        "indicator_codes": ["3-1-1-1", "3-1-1-2"],
        "baseline_value": "18.8",
        "target_value": "28.8",
        "unit": "%",
        "kpi_description": "نسبة تحسن نتائج الطلاب في نافس",
    },
    {
        "key": "support",
        "label": "الدعم والتقوية",
        "program_name": "حصص الدعم والتقوية",
        "strategic_goal": "رفع مستوى التحصيل العلمي للطلاب وتحسين نتائجهم في الاختبارات الوطنية (نافس).",
        "goal_ref": "G3",
        "domain": "نواتج التعلم",
        "level_name": "انطلاق",
        "executive_goal": "تقديم حصص تقوية مركزة للطلاب ذوي الأداء المنخفض وفق التشخيص",
        "target_audience": "الطلاب الحاصلون على تقدير دون المتوسط في الاختبارات التشخيصية",
        "duration": "فصلي وفق جدول الدعم المعتمد",
        "implementers": "معلمو المواد تحت إشراف وكيل الشؤون التعليمية",
        "budget": "ذاتية",
        "mechanism": "1. فرز المستهدفين من التشخيص.\n2. مجموعات تقوية صغيرة بجدول ثابت.\n3. قياس بعدي كل أربعة أسابيع.\n4. توثيق الحضور والأثر في سجل المناهج والتقويم.",
        "success_indicator": "انتقال 70% من المستهدفين مستوىً تحصيلياً واحداً على الأقل",
        "risk_management": "تعارض الجدول يُحل بإعادة جدولة مرنة أو دعم داخل الحصة",
        "register_id": 3,
        "owner_role": "vice_teachers",
        "indicator_codes": ["3-1-1-2", "2-1-1-6"],
        "unit": "%",
        "kpi_description": "نسبة المستفيدين الذين ارتقوا مستوىً تحصيلياً",
    },
    {
        "key": "visits",
        "label": "الزيارات الصفية",
        "program_name": "الزيارات الصفية الاستطلاعية والتقويمية",
        "strategic_goal": "تحسين جودة عمليات التعليم والتعلم من خلال بناء خبرات تعلمية فاعلة وتقويم مستمر.",
        "goal_ref": "G2",
        "domain": "التعليم والتعلم",
        "level_name": "انطلاق",
        "executive_goal": "متابعة جودة التدريس وتنمية مهارات التفكير العليا عبر زيارات صفية منتظمة",
        "target_audience": "جميع معلمي المواد",
        "duration": "مستمر وفق خطة الزيارات",
        "implementers": "وكيل الشؤون التعليمية ومدير المدرسة",
        "budget": "ذاتية",
        "mechanism": "1. خطة زيارات فصلية معلنة.\n2. بطاقة ملاحظة تشمل استراتيجيات التدريس والتفكير العليا.\n3. تغذية راجعة مكتوبة ومتابعة أثر.\n4. رصد نسبة المعلمين المطبقين للاستراتيجيات المستهدفة.",
        "success_indicator": "تنفيذ 100% من الزيارات المخططة ووصول 85% من المعلمين لتطبيق الاستراتيجيات المستهدفة",
        "risk_management": "ضغط الجدول يُعالَج بزيارات قصيرة مركّزة وإعادة الجدولة أسبوعياً",
        "register_id": 2,
        "owner_role": "vice_teachers",
        "indicator_codes": ["2-1-1-3", "2-1-1-7", "2-2-1-3"],
        "baseline_value": "60",
        "target_value": "85",
        "unit": "%",
        "kpi_description": "نسبة المعلمين المطبقين للاستراتيجيات الحديثة",
    },
    {
        "key": "plc",
        "label": "مجتمعات التعلم",
        "program_name": "مجتمعات التعلم المهنية (PLCs)",
        "strategic_goal": "تحسين جودة عمليات التعليم والتعلم من خلال بناء خبرات تعلمية فاعلة وتقويم مستمر.",
        "goal_ref": "G2",
        "domain": "التعليم والتعلم",
        "level_name": "انطلاق",
        "executive_goal": "بناء مجتمعات تعلم مهنية أسبوعية تركز على تحسين نواتج الطلاب",
        "target_audience": "مجتمعات معلمي المواد",
        "duration": "مستمر طوال العام",
        "implementers": "وكيل الشؤون التعليمية وقادة المجتمعات",
        "budget": "ذاتية",
        "mechanism": "1. تشكيل مجتمعات حسب التخصص.\n2. اجتماع أسبوعي بمحضر وهدف تعلّم.\n3. تجربة صفية مشتركة وقياس أثر.\n4. مشاركة النتائج في التطوير المهني.",
        "success_indicator": "عقد مجتمع تعلم واحد على الأقل لكل تخصص شهرياً مع محضر وأثر موثّق",
        "risk_management": "ضعف الالتزام يُعالَج بربط الحضور بخطة التطوير المهني",
        "register_id": 2,
        "owner_role": "vice_teachers",
        "indicator_codes": ["1-4-1-2", "2-1-1-3"],
        "unit": "عدد",
        "kpi_description": "عدد مجتمعات التعلم المنفذة بمحاضر معتمدة",
    },
    {
        "key": "evacuation",
        "label": "فرضيات الإخلاء",
        "program_name": "فرضيات الإخلاء الدورية",
        "strategic_goal": "توفير بيئة مدرسية آمنة وصحية محفزة على التعلم وفق معايير الأمن والسلامة.",
        "goal_ref": "G4",
        "domain": "البيئة المدرسية",
        "level_name": "انطلاق",
        "executive_goal": "تنفيذ فرضيات إخلاء دورية وقياس زمن الخروج وتصحيح الملاحظات",
        "target_audience": "جميع المنسوبين والطلاب",
        "duration": "ثلاث فرضيات على الأقل خلال العام",
        "implementers": "فريق الأمن والسلامة ووكيل شؤون الطلاب",
        "budget": "ذاتية",
        "mechanism": "1. جدولة الفرضيات في التقويم المعتمد.\n2. تنفيذ الفرضية بمحضر زمني.\n3. معالجة الملاحظات خلال أسبوعين.\n4. حفظ الشواهد في سجل البيئة والموارد.",
        "success_indicator": "تنفيذ 100% من الفرضيات المجدولة (3 سنوياً)",
        "risk_management": "تعارض المناسبة يُعاد جدولته خلال أسبوع مع إشعار المنسوبين",
        "register_id": 6,
        "owner_role": "vice_students",
        "indicator_codes": ["4-2-1-1"],
        "baseline_value": "1",
        "target_value": "3",
        "unit": "عدد",
        "kpi_description": "عدد فرضيات الإخلاء المنفذة سنوياً",
    },
    {
        "key": "building",
        "label": "صيانة المبنى",
        "program_name": "صيانة المبنى والمرافق",
        "strategic_goal": "توفير بيئة مدرسية آمنة وصحية محفزة على التعلم وفق معايير الأمن والسلامة.",
        "goal_ref": "G4",
        "domain": "البيئة المدرسية",
        "level_name": "تهيئة",
        "executive_goal": "تحسين ملاءمة المبنى والمرافق المساندة لاحتياجات المتعلمين بمن فيهم ذوو الإعاقة",
        "target_audience": "جميع المنسوبين والطلاب",
        "duration": "مستمر مع جولات شهرية",
        "implementers": "وكيل شؤون الطلاب ومدير المدرسة",
        "budget": "طلبات صيانة رسمية + تشغيل ذاتي للنواقص البسيطة",
        "mechanism": "1. جرد شهري للمرافق والفصول والمعامل.\n2. رفع نواقص الاشتراطات والوصولية بخطابات رسمية.\n3. تنفيذ تحسينات تنظيمية فورية داخل المدرسة.\n4. متابعة إغلاق المعاملات وتوثيق قبل/بعد.",
        "success_indicator": "إغلاق 80% من ملاحظات الصيانة المرفوعة خلال الفصل وإخراج مؤشري المبنى من التهيئة",
        "risk_management": "تأخر الجهة المختصة يُوثَّق مع إجراءات سلامة مؤقتة",
        "register_id": 6,
        "owner_role": "vice_students",
        "owner_roles": ["vice_students", "principal"],
        "indicator_codes": ["4-1-1-1", "4-1-1-3", "4-2-1-2"],
        "baseline_value": "60.5",
        "target_value": "75",
        "unit": "%",
        "kpi_description": "نسبة تحقق ملاءمة المبنى والمرافق المساندة",
    },
    {
        "key": "parent_meet",
        "label": "لقاء أولياء الأمور",
        "program_name": "لقاء الشراكة مع أولياء الأمور",
        "strategic_goal": "تعزيز الشراكة المجتمعية مع أولياء الأمور والمؤسسات المحلية.",
        "goal_ref": "G7",
        "domain": "الإدارة المدرسية",
        "level_name": "تقدم",
        "executive_goal": "رفع مشاركة الأسرة في تعلم الأبناء ومتابعة التحصيل والسلوك",
        "target_audience": "أولياء الأمور، المجتمع المحلي",
        "duration": "لقاءات فصلية وفق التقويم",
        "implementers": "مدير المدرسة والموجه الطلابي ورواد الفصول",
        "budget": "ذاتية",
        "mechanism": "1. دعوة منظّمة عبر نور ووسائل التواصل.\n2. عرض نتائج وتحصيل وخطة تحسين.\n3. ورش قصيرة لأولياء الأمور.\n4. قياس الحضور والأثر في محضر اللقاء.",
        "success_indicator": "حضور لا يقل عن 70% من أولياء الأمور المستدعين في اللقاءات المعتمدة",
        "risk_management": "ضعف الحضور يُعوَّض بلقاءات فصول مصغّرة ومتابعة هاتفية",
        "register_id": 5,
        "owner_role": "principal",
        "owner_roles": ["principal", "student_counselor"],
        "indicator_codes": ["1-3-1-2", "1-3-1-3"],
        "baseline_value": "50",
        "target_value": "70",
        "unit": "%",
        "kpi_description": "نسبة حضور أولياء الأمور للاجتماعات",
    },
    {
        "key": "irtiqaa",
        "label": "ارتقاء",
        "program_name": "رائد الشراكة المجتمعية (ارتقاء)",
        "strategic_goal": "تعزيز الشراكة المجتمعية مع أولياء الأمور والمؤسسات المحلية.",
        "goal_ref": "G7",
        "domain": "الإدارة المدرسية",
        "level_name": "تهيئة",
        "executive_goal": "تفعيل برنامج ارتقاء بشراكات مجتمعية تدعم التعلم",
        "target_audience": "أولياء الأمور، المجتمع المحلي",
        "duration": "مستمر وفق مبادرات ارتقاء",
        "implementers": "رائد النشاط ومدير المدرسة",
        "budget": "دعم الشركاء / ذاتية",
        "mechanism": "1. تسجيل المبادرات وفق ضوابط ارتقاء.\n2. تنفيذ أنشطة مشتركة مع أثر تعليمي.\n3. توثيق الشواهد والمستفيدين.\n4. تقرير فصلي للجنة الإدارية.",
        "success_indicator": "تنفيذ مبادرتين ارتقاء على الأقل لكل فصل دراسي بأثر موثّق",
        "risk_management": "اعتذار الشريك يُعوَّض بشريك بديل من قائمة الحصر",
        "register_id": 5,
        "owner_role": "activity_leader",
        "owner_roles": ["activity_leader", "principal"],
        "indicator_codes": ["1-3-1-3"],
        "unit": "عدد",
        "kpi_description": "عدد مبادرات ارتقاء المنفذة بأثر موثّق",
    },
    {
        "key": "volunteer",
        "label": "التطوع الطلابي",
        "program_name": "العمل التطوعي الطلابي",
        "strategic_goal": "تعزيز الشراكة المجتمعية مع أولياء الأمور والمؤسسات المحلية.",
        "goal_ref": "G7",
        "domain": "نواتج التعلم",
        "level_name": "تقدم",
        "executive_goal": "إشراك الطلاب في أعمال تطوعية مجتمعية تعزز المسؤولية والقيم",
        "target_audience": "جميع طلاب المدرسة",
        "duration": "مستمر مع مناسبات وطنية ومجتمعية",
        "implementers": "رائد النشاط والموجه الطلابي",
        "budget": "ذاتية",
        "mechanism": "1. خطة تطوع فصلية مرتبطة بالمناسبات.\n2. تسجيل المشاركين وساعات التطوع.\n3. تنفيذ الخدمة داخل المدرسة أو المجتمع المحلي.\n4. احتفاء وتوثيق في سجل الأنشطة.",
        "success_indicator": "مشاركة لا تقل عن 60% من الطلاب في عمل تطوعي واحد على الأقل سنوياً",
        "risk_management": "تعارض الاختبارات يُعاد جدولة النشاط بعد فترة القياس",
        "register_id": 5,
        "owner_role": "activity_leader",
        "indicator_codes": ["3-2-1-4", "1-3-1-3"],
        "baseline_value": "40",
        "target_value": "60",
        "unit": "%",
        "kpi_description": "نسبة مشاركة الطلاب في الأعمال التطوعية",
    },
    {
        "key": "planning",
        "label": "التخطيط الاستراتيجي",
        "program_name": "التخطيط الاستراتيجي المدرسي",
        "strategic_goal": "تطوير منظومة القيادة المدرسية وتفعيل التخطيط الاستراتيجي المبني على البيانات.",
        "goal_ref": "G1",
        "domain": "الإدارة المدرسية",
        "level_name": "انطلاق",
        "executive_goal": "استكمال الخطة التشغيلية ومتابعة تنفيذها وفق مؤشرات الأداء",
        "target_audience": "فريق القيادة وأصحاب الخطط",
        "duration": "بداية العام مع مراجعات فصلية",
        "implementers": "مدير المدرسة ولجنة التميز",
        "budget": "ذاتية",
        "mechanism": "1. بناء الخطة من بيانات التقويم والتقويم الذاتي.\n2. توزيع البرامج على أصحاب الأدوار.\n3. متابعة أسبوعية لنسب التنفيذ.\n4. تقويم فصلي وتعديل المسار.",
        "success_indicator": "اعتماد الخطة في وقتها وتنفيذ لا يقل عن 90% من البرامج التطويرية المخططة",
        "risk_management": "تأخر إدخال البيانات يُعالَج بتجميد موعد الاعتماد واجتماع طارئ للفريق",
        "register_id": 1,
        "owner_role": "principal",
        "indicator_codes": ["1-1-1-1", "1-1-1-2"],
        "baseline_value": "70",
        "target_value": "100",
        "unit": "%",
        "kpi_description": "نسبة اعتماد الخطط التشغيلية في وقتها",
    },
    {
        "key": "pd",
        "label": "التطوير المهني",
        "program_name": "التطوير المهني الداخلي",
        "strategic_goal": "تطوير الكوادر التعليمية والإدارية مهنيًا وتحسين كفاءتهم.",
        "goal_ref": "G6",
        "domain": "الإدارة المدرسية",
        "level_name": "تقدم",
        "executive_goal": "تلبية احتياجات التطوير المهني وفق نتائج الأداء والزيارات الصفية",
        "target_audience": "المعلمون والإداريون",
        "duration": "فصلي وفق خطة التطوير المهني",
        "implementers": "وكيل الشؤون التعليمية ومدير المدرسة",
        "budget": "من برامج الوزارة والتطوير الداخلي",
        "mechanism": "1. تحليل احتياجات من الزيارات والتقويم الوظيفي.\n2. ورش داخلية ودروس تطبيقية.\n3. متابعة أثر التدريب في الصف.\n4. توثيق الحضور في سجل التطوير المهني.",
        "success_indicator": "حضور 100% من المعلمين لبرنامج تطويري واحد على الأقل كل فصل",
        "risk_management": "تعارض الاختبارات يُجدول التدريب في أوقات مرنة أو بعد الدوام القصير",
        "register_id": 2,
        "owner_role": "vice_teachers",
        "indicator_codes": ["1-4-1-2"],
        "baseline_value": "70",
        "target_value": "100",
        "unit": "%",
        "kpi_description": "نسبة حضور المعلمين للبرامج التدريبية",
    },
    # دفعة المعلم · قرار 143 · من 17_programs_by_staff_plan.md (75–82) · بلا اختراع مؤشر رقمي
    {
        "key": "fun_math",
        "label": "الرياضيات الممتعة",
        "program_name": "مبادرة الرياضيات الممتعة",
        "strategic_goal": "",
        "goal_ref": "G3",
        "domain": "نواتج التعلم",
        "level_name": "",
        "executive_goal": "",
        "target_audience": "",
        "duration": "",
        "implementers": "المعلم",
        "budget": "",
        "mechanism": "",
        "success_indicator": "",
        "risk_management": "",
        "register_id": 3,
        "owner_role": "teacher",
        "indicator_codes": ["2-1-1-5", "2-2-1-1"],
        "baseline_value": "",
        "target_value": "",
        "unit": "",
        "kpi_description": "",
    },
    {
        "key": "comm_skills",
        "label": "مهارات التواصل",
        "program_name": "برنامج مهارات التواصل",
        "strategic_goal": "",
        "goal_ref": "G2",
        "domain": "نواتج التعلم",
        "level_name": "",
        "executive_goal": "",
        "target_audience": "",
        "duration": "",
        "implementers": "المعلم",
        "budget": "",
        "mechanism": "",
        "success_indicator": "",
        "risk_management": "",
        "register_id": 3,
        "owner_role": "teacher",
        "indicator_codes": ["2-1-1-2", "2-1-1-5"],
        "baseline_value": "",
        "target_value": "",
        "unit": "",
        "kpi_description": "",
    },
    {
        "key": "study_skills",
        "label": "مهارات المذاكرة",
        "program_name": "برنامج مهارات المذاكرة",
        "strategic_goal": "",
        "goal_ref": "G3",
        "domain": "نواتج التعلم",
        "level_name": "",
        "executive_goal": "",
        "target_audience": "",
        "duration": "",
        "implementers": "المعلم",
        "budget": "",
        "mechanism": "",
        "success_indicator": "",
        "risk_management": "",
        "register_id": 3,
        "owner_role": "teacher",
        "indicator_codes": ["2-1-1-5", "2-2-1-1"],
        "baseline_value": "",
        "target_value": "",
        "unit": "",
        "kpi_description": "",
    },
    {
        "key": "basic_mastery",
        "label": "إتقان المهارات الأساسية",
        "program_name": "برنامج إتقان المهارات الأساسية",
        "strategic_goal": "",
        "goal_ref": "G3",
        "domain": "نواتج التعلم",
        "level_name": "",
        "executive_goal": "",
        "target_audience": "",
        "duration": "",
        "implementers": "المعلم",
        "budget": "",
        "mechanism": "",
        "success_indicator": "",
        "risk_management": "",
        "register_id": 3,
        "owner_role": "teacher",
        "indicator_codes": ["2-2-1-1", "2-2-1-2"],
        "baseline_value": "",
        "target_value": "",
        "unit": "",
        "kpi_description": "",
    },
    {
        "key": "subject_support_teacher",
        "label": "دعم المواد (خطة المعلم)",
        "program_name": "برنامج دعم في المواد الأساسية",
        "strategic_goal": "",
        "goal_ref": "G3",
        "domain": "نواتج التعلم",
        "level_name": "",
        "executive_goal": "",
        "target_audience": "",
        "duration": "",
        "implementers": "المعلم",
        "budget": "",
        "mechanism": "",
        "success_indicator": "",
        "risk_management": "",
        "register_id": 3,
        "owner_role": "teacher",
        "indicator_codes": ["2-2-1-1", "2-2-1-3"],
        "baseline_value": "",
        "target_value": "",
        "unit": "",
        "kpi_description": "",
    },
    {
        "key": "critical_thinking",
        "label": "التفكير الناقد",
        "program_name": "برنامج التفكير الناقد",
        "strategic_goal": "",
        "goal_ref": "G2",
        "domain": "التعليم والتعلم",
        "level_name": "",
        "executive_goal": "",
        "target_audience": "",
        "duration": "",
        "implementers": "المعلم",
        "budget": "",
        "mechanism": "",
        "success_indicator": "",
        "risk_management": "",
        "register_id": 3,
        "owner_role": "teacher",
        "indicator_codes": ["2-1-1-5", "2-2-1-1"],
        "baseline_value": "",
        "target_value": "",
        "unit": "",
        "kpi_description": "",
    },
    {
        "key": "creative_writing",
        "label": "الكتابة الإبداعية",
        "program_name": "برنامج الكتابة الإبداعية",
        "strategic_goal": "",
        "goal_ref": "G3",
        "domain": "نواتج التعلم",
        "level_name": "",
        "executive_goal": "",
        "target_audience": "",
        "duration": "",
        "implementers": "المعلم",
        "budget": "",
        "mechanism": "",
        "success_indicator": "",
        "risk_management": "",
        "register_id": 3,
        "owner_role": "teacher",
        "indicator_codes": ["2-1-1-2", "2-2-1-1"],
        "baseline_value": "",
        "target_value": "",
        "unit": "",
        "kpi_description": "",
    },
    {
        "key": "creative_writing_club",
        "label": "نادي الكتابة الإبداعية",
        "program_name": "نادي الكتابة الإبداعية",
        "strategic_goal": "",
        "goal_ref": "G3",
        "domain": "نواتج التعلم",
        "level_name": "",
        "executive_goal": "",
        "target_audience": "",
        "duration": "",
        "implementers": "المعلم",
        "budget": "",
        "mechanism": "",
        "success_indicator": "",
        "risk_management": "",
        "register_id": 5,
        "owner_role": "teacher",
        "indicator_codes": ["2-1-1-2"],
        "baseline_value": "",
        "target_value": "",
        "unit": "",
        "kpi_description": "",
    },
    # م5/د2 · قرار 148 · بانتظار اعتماد بشري · بلا overlap
    {
        "key": "rifq",
        "label": "رفق",
        "program_name": "برنامج رفق للحد من التنمر",
        "strategic_goal": "",
        "goal_ref": "G5",
        "domain": "نواتج التعلم",
        "level_name": "",
        "executive_goal": "",
        "target_audience": "",
        "duration": "",
        "implementers": "وكيل شؤون الطلاب، الموجه الطلابي",
        "budget": "",
        "mechanism": "رصد الحالات · جلسات توعية · توثيق عبر TPL-05/TPL-07 تحت إشراف وكيل الطلاب والموجه",
        "success_indicator": "",
        "risk_management": "",
        "register_id": 4,
        "owner_role": "vice_students",
        "owner_roles": ["vice_students", "student_counselor"],
        "indicator_codes": ["1-2-1-1"],
        "baseline_value": "",
        "target_value": "",
        "unit": "",
        "kpi_description": "",
    },
    {
        "key": "green_school",
        "label": "مدرسة خضراء",
        "program_name": "مبادرة مدرسة خضراء",
        "strategic_goal": "",
        "goal_ref": "G4",
        "domain": "البيئة المدرسية",
        "level_name": "",
        "executive_goal": "",
        "target_audience": "",
        "duration": "",
        "implementers": "وكيل شؤون الطلاب",
        "budget": "",
        "mechanism": "فعاليات بيئية موثّقة · متابعة عبر سجل البيئة · TPL-01 عند التوثيق",
        "success_indicator": "",
        "risk_management": "",
        "register_id": 6,
        "owner_role": "vice_students",
        "indicator_codes": [],
        "baseline_value": "",
        "target_value": "",
        "unit": "",
        "kpi_description": "",
    },
    {
        "key": "tree_season",
        "label": "التشجير الوطني",
        "program_name": "مبادرة موسم التشجير الوطني",
        "strategic_goal": "",
        "goal_ref": "G4",
        "domain": "البيئة المدرسية",
        "level_name": "",
        "executive_goal": "",
        "target_audience": "",
        "duration": "",
        "implementers": "وكيل شؤون الطلاب",
        "budget": "",
        "mechanism": "مشاركة موسمية في التشجير · توثيق شاهد/تقرير",
        "success_indicator": "",
        "risk_management": "",
        "register_id": 6,
        "owner_role": "vice_students",
        "indicator_codes": [],
        "baseline_value": "",
        "target_value": "",
        "unit": "",
        "kpi_description": "",
        "seasonal": True,
    },
    {
        "key": "disciplined_class",
        "label": "الفصل المنضبط",
        "program_name": "مسابقة الفصل المنضبط",
        "strategic_goal": "",
        "goal_ref": "G5",
        "domain": "نواتج التعلم",
        "level_name": "",
        "executive_goal": "",
        "target_audience": "",
        "duration": "",
        "implementers": "وكيل شؤون الطلاب",
        "budget": "",
        "mechanism": "مسابقة فصول بمعايير مواظبة/سلوك · توثيق عبر TPL-01 · ليس بديلاً عن برنامج الانضباط النووي",
        "success_indicator": "",
        "risk_management": "",
        "register_id": 4,
        "owner_role": "vice_students",
        "indicator_codes": ["1-2-1-1"],
        "baseline_value": "",
        "target_value": "",
        "unit": "",
        "kpi_description": "",
    },
    # م5/د3-أ · أمين مصادر · قرار 149 · بانتظار اعتماد بشري قبل د3-ب
    {
        "key": "reading_init",
        "label": "مبادرة القراءة",
        "program_name": "مبادرة القراءة",
        "strategic_goal": "",
        "goal_ref": "G2",
        "domain": "التعليم والتعلم",
        "level_name": "",
        "executive_goal": "",
        "target_audience": "",
        "duration": "",
        "implementers": "أمين مصادر التعلم",
        "budget": "",
        "mechanism": "تنفيذ عبر أمين مصادر التعلم · توثيق TPL-05/TPL-01",
        "success_indicator": "",
        "risk_management": "",
        "register_id": 5,
        "owner_role": "librarian",
        "indicator_codes": ["2-1-1-2"],
        "baseline_value": "",
        "target_value": "",
        "unit": "",
        "kpi_description": "",
    },
    {
        "key": "reading_for_all",
        "label": "القراءة للجميع",
        "program_name": "مبادرة القراءة للجميع",
        "strategic_goal": "",
        "goal_ref": "G2",
        "domain": "التعليم والتعلم",
        "level_name": "",
        "executive_goal": "",
        "target_audience": "",
        "duration": "",
        "implementers": "أمين مصادر التعلم",
        "budget": "",
        "mechanism": "تنفيذ عبر أمين مصادر التعلم · توثيق TPL-05/TPL-01",
        "success_indicator": "",
        "risk_management": "",
        "register_id": 5,
        "owner_role": "librarian",
        "indicator_codes": ["2-1-1-2"],
        "baseline_value": "",
        "target_value": "",
        "unit": "",
        "kpi_description": "",
    },
    {
        "key": "reading_club",
        "label": "نادي القراءة",
        "program_name": "نادي القراءة",
        "strategic_goal": "",
        "goal_ref": "G2",
        "domain": "التعليم والتعلم",
        "level_name": "",
        "executive_goal": "",
        "target_audience": "",
        "duration": "",
        "implementers": "أمين مصادر التعلم",
        "budget": "",
        "mechanism": "تنفيذ عبر أمين مصادر التعلم · توثيق TPL-05/TPL-01",
        "success_indicator": "",
        "risk_management": "",
        "register_id": 5,
        "owner_role": "librarian",
        "indicator_codes": ["2-1-1-2"],
        "baseline_value": "",
        "target_value": "",
        "unit": "",
        "kpi_description": "",
    },
    {
        "key": "free_reading_week",
        "label": "أسبوع القراءة الحرة",
        "program_name": "أسبوع القراءة الحرة",
        "strategic_goal": "",
        "goal_ref": "G2",
        "domain": "التعليم والتعلم",
        "level_name": "",
        "executive_goal": "",
        "target_audience": "",
        "duration": "",
        "implementers": "أمين مصادر التعلم",
        "budget": "",
        "mechanism": "تنفيذ عبر أمين مصادر التعلم · توثيق TPL-05/TPL-01",
        "success_indicator": "",
        "risk_management": "",
        "register_id": 5,
        "owner_role": "librarian",
        "indicator_codes": ["2-1-1-2"],
        "baseline_value": "",
        "target_value": "",
        "unit": "",
        "kpi_description": "",
        "seasonal": True,
    },
    {
        "key": "sources_research",
        "label": "البحث في المصادر",
        "program_name": "برنامج البحث في المصادر",
        "strategic_goal": "",
        "goal_ref": "G2",
        "domain": "التعليم والتعلم",
        "level_name": "",
        "executive_goal": "",
        "target_audience": "",
        "duration": "",
        "implementers": "أمين مصادر التعلم",
        "budget": "",
        "mechanism": "تنفيذ عبر أمين مصادر التعلم · توثيق TPL-05/TPL-01",
        "success_indicator": "",
        "risk_management": "",
        "register_id": 6,
        "owner_role": "librarian",
        "indicator_codes": ["2-1-1-2"],
        "baseline_value": "",
        "target_value": "",
        "unit": "",
        "kpi_description": "",
    },
    {
        "key": "library_free_reading",
        "label": "قراءة في حصص المكتبة",
        "program_name": "برنامج القراءة الحرة في حصص المكتبة",
        "strategic_goal": "",
        "goal_ref": "G2",
        "domain": "التعليم والتعلم",
        "level_name": "",
        "executive_goal": "",
        "target_audience": "",
        "duration": "",
        "implementers": "أمين مصادر التعلم",
        "budget": "",
        "mechanism": "تنفيذ عبر أمين مصادر التعلم · توثيق TPL-05/TPL-01",
        "success_indicator": "",
        "risk_management": "",
        "register_id": 5,
        "owner_role": "librarian",
        "indicator_codes": ["2-1-1-2"],
        "baseline_value": "",
        "target_value": "",
        "unit": "",
        "kpi_description": "",
    },
    {
        "key": "seerah_reading_contest",
        "label": "مسابقة قراءة السيرة",
        "program_name": "مسابقة القراءة في السيرة النبوية",
        "strategic_goal": "",
        "goal_ref": "G2",
        "domain": "التعليم والتعلم",
        "level_name": "",
        "executive_goal": "",
        "target_audience": "",
        "duration": "",
        "implementers": "أمين مصادر التعلم",
        "budget": "",
        "mechanism": "تنفيذ عبر أمين مصادر التعلم · توثيق TPL-05/TPL-01",
        "success_indicator": "",
        "risk_management": "",
        "register_id": 5,
        "owner_role": "librarian",
        "indicator_codes": ["2-1-1-2"],
        "baseline_value": "",
        "target_value": "",
        "unit": "",
        "kpi_description": "",
    },
    {
        "key": "reading_contest",
        "label": "مسابقة القراءة",
        "program_name": "مسابقة القراءة",
        "strategic_goal": "",
        "goal_ref": "G2",
        "domain": "التعليم والتعلم",
        "level_name": "",
        "executive_goal": "",
        "target_audience": "",
        "duration": "",
        "implementers": "أمين مصادر التعلم",
        "budget": "",
        "mechanism": "تنفيذ عبر أمين مصادر التعلم · توثيق TPL-05/TPL-01",
        "success_indicator": "",
        "risk_management": "",
        "register_id": 5,
        "owner_role": "librarian",
        "indicator_codes": ["2-1-1-2"],
        "baseline_value": "",
        "target_value": "",
        "unit": "",
        "kpi_description": "",
    },
    # م5/د4-أ · مناسبة وطنية فقط · قرار 151
    {
        "key": "national_day",
        "label": "اليوم الوطني",
        "program_name": "برنامج اليوم الوطني",
        "strategic_goal": "",
        "goal_ref": "G7",
        "domain": "المجتمع المدرسي",
        "level_name": "",
        "executive_goal": "",
        "target_audience": "",
        "duration": "موسمي — اليوم الوطني",
        "implementers": "رائد النشاط الطلابي",
        "budget": "",
        "mechanism": "فعاليات اليوم الوطني · توثيق TPL-01/TPL-08a · بند ن.ط-04",
        "success_indicator": "",
        "risk_management": "",
        "register_id": 5,
        "owner_role": "activity_leader",
        "indicator_codes": ["1-3-1-3"],
        "baseline_value": "",
        "target_value": "",
        "unit": "",
        "kpi_description": "",
        "seasonal": True,
    },
    # م5/د4-ب · إعلام/توعية · قرار 152 · N=3
    {
        "key": "school_broadcast",
        "label": "الإذاعة المدرسية",
        "program_name": "برنامج الإذاعة المدرسية",
        "strategic_goal": "",
        "goal_ref": "G7",
        "domain": "المجتمع المدرسي",
        "level_name": "",
        "executive_goal": "",
        "target_audience": "",
        "duration": "مستمر طوال العام",
        "implementers": "رائد النشاط الطلابي",
        "budget": "",
        "mechanism": "تشغيل إذاعة مدرسية منتظمة · توثيق TPL-01 · بند ن.ط-03",
        "success_indicator": "",
        "risk_management": "",
        "register_id": 5,
        "owner_role": "activity_leader",
        "indicator_codes": ["1-3-1-3"],
        "baseline_value": "",
        "target_value": "",
        "unit": "",
        "kpi_description": "",
        "seasonal": False,
    },
    {
        "key": "radio_program",
        "label": "برنامج إذاعي",
        "program_name": "برنامج إذاعي",
        "strategic_goal": "",
        "goal_ref": "G7",
        "domain": "المجتمع المدرسي",
        "level_name": "",
        "executive_goal": "",
        "target_audience": "",
        "duration": "مستمر طوال العام",
        "implementers": "رائد النشاط الطلابي",
        "budget": "",
        "mechanism": "فقرات إذاعية مجدولة · توثيق TPL-01 · قريب من الإذاعة المدرسية",
        "success_indicator": "",
        "risk_management": "",
        "register_id": 5,
        "owner_role": "activity_leader",
        "indicator_codes": ["1-3-1-3"],
        "baseline_value": "",
        "target_value": "",
        "unit": "",
        "kpi_description": "",
        "seasonal": False,
    },
    {
        "key": "white_cane_day",
        "label": "اليوم العالمي للعصا البيضاء",
        "program_name": "مبادرة اليوم العالمي للعصا البيضاء",
        "strategic_goal": "",
        "goal_ref": "G7",
        "domain": "المجتمع المدرسي",
        "level_name": "",
        "executive_goal": "",
        "target_audience": "",
        "duration": "موسمي",
        "implementers": "رائد النشاط الطلابي",
        "budget": "",
        "mechanism": "فعالية توعية موسمية · توثيق TPL-01",
        "success_indicator": "",
        "risk_management": "",
        "register_id": 5,
        "owner_role": "activity_leader",
        "indicator_codes": ["1-3-1-3"],
        "baseline_value": "",
        "target_value": "",
        "unit": "",
        "kpi_description": "",
        "seasonal": True,
    },
    # م5/د4-ج · مسابقات · قرار 154 · N=3
    {
        "key": "speech_contest",
        "label": "مسابقة الإلقاء",
        "program_name": "مسابقة الإلقاء",
        "strategic_goal": "",
        "goal_ref": "G7",
        "domain": "المجتمع المدرسي",
        "level_name": "",
        "executive_goal": "",
        "target_audience": "",
        "duration": "مستمر وفق خطة النشاط",
        "implementers": "رائد النشاط الطلابي",
        "budget": "",
        "mechanism": "مسابقة إلقاء داخل المدرسة · توثيق TPL-01 · بند ن.ط-13",
        "success_indicator": "",
        "risk_management": "",
        "register_id": 5,
        "owner_role": "activity_leader",
        "indicator_codes": ["1-3-1-3"],
        "baseline_value": "",
        "target_value": "",
        "unit": "",
        "kpi_description": "",
        "seasonal": False,
    },
    {
        "key": "sports_contests",
        "label": "المسابقات الرياضية",
        "program_name": "برنامج المسابقات الرياضية",
        "strategic_goal": "",
        "goal_ref": "G7",
        "domain": "المجتمع المدرسي",
        "level_name": "",
        "executive_goal": "",
        "target_audience": "",
        "duration": "مستمر وفق خطة النشاط",
        "implementers": "رائد النشاط الطلابي",
        "budget": "",
        "mechanism": "مسابقات رياضية مجدولة · توثيق TPL-01 · بند ن.ط-08",
        "success_indicator": "",
        "risk_management": "",
        "register_id": 5,
        "owner_role": "activity_leader",
        "indicator_codes": ["1-3-1-3"],
        "baseline_value": "",
        "target_value": "",
        "unit": "",
        "kpi_description": "",
        "seasonal": False,
    },
    {
        "key": "calligraphy_speech_contest",
        "label": "مسابقة الخط والإلقاء",
        "program_name": "مسابقة الخط والإلقاء · مطوية «لغتي هويتي»",
        "strategic_goal": "",
        "goal_ref": "G7",
        "domain": "المجتمع المدرسي",
        "level_name": "",
        "executive_goal": "",
        "target_audience": "",
        "duration": "مستمر وفق خطة النشاط",
        "implementers": "رائد النشاط الطلابي",
        "budget": "",
        "mechanism": "مسابقة خط/إلقاء مع مطوية لغتي هويتي · توثيق TPL-01",
        "success_indicator": "",
        "risk_management": "",
        "register_id": 5,
        "owner_role": "activity_leader",
        "indicator_codes": ["1-3-1-3"],
        "baseline_value": "",
        "target_value": "",
        "unit": "",
        "kpi_description": "",
        "seasonal": False,
    },

    # خ-إغلاق د5 · قرار 155
    {
        "key": "physics_med_day",
        "label": "الفيزياء الطبية",
        "program_name": "اليوم العالمي للفيزياء الطبية ودور ماري كوري",
        "strategic_goal": "",
        "goal_ref": "G2",
        "domain": "التعليم والتعلم",
        "level_name": "",
        "executive_goal": "",
        "target_audience": "",
        "duration": "موسمي",
        "implementers": "محضر المختبر",
        "budget": "",
        "mechanism": "فعالية توعية علمية موسمية · توثيق TPL-01 · بند LAB-01",
        "success_indicator": "",
        "risk_management": "",
        "register_id": 6,
        "owner_role": "lab_tech",
        "indicator_codes": [],
        "baseline_value": "",
        "target_value": "",
        "unit": "",
        "kpi_description": "",
        "seasonal": True,
    },
    {
        "key": "lab_setup",
        "label": "تجهيز معمل العلوم",
        "program_name": "مبادرة تجهيز معمل العلوم",
        "strategic_goal": "",
        "goal_ref": "G4",
        "domain": "البيئة المدرسية",
        "level_name": "",
        "executive_goal": "",
        "target_audience": "",
        "duration": "مستمر",
        "implementers": "محضر المختبر",
        "budget": "",
        "mechanism": "تجهيز ومتابعة المعامل · توثيق TPL-05 · بند LAB-02",
        "success_indicator": "",
        "risk_management": "",
        "register_id": 6,
        "owner_role": "lab_tech",
        "indicator_codes": [],
        "baseline_value": "",
        "target_value": "",
        "unit": "",
        "kpi_description": "",
        "seasonal": False,
    },
    {
        "key": "digital_transform",
        "label": "التحول الرقمي",
        "program_name": "مبادرة التحول الرقمي",
        "strategic_goal": "",
        "goal_ref": "G6",
        "domain": "الإدارة المدرسية",
        "level_name": "",
        "executive_goal": "",
        "target_audience": "",
        "duration": "مستمر",
        "implementers": "المساعد الإداري",
        "budget": "",
        "mechanism": "تنسيق التحول الرقمي الإداري · توثيق TPL-05 · بند ADM-01",
        "success_indicator": "",
        "risk_management": "",
        "register_id": 1,
        "owner_role": "admin_assistant",
        "indicator_codes": [],
        "baseline_value": "",
        "target_value": "",
        "unit": "",
        "kpi_description": "",
        "seasonal": False,
    },
)

TEMPLATE_BY_KEY = {item["key"]: item for item in TEMPLATES}


def _goal_map():
    from .operational_plan import read_plan

    out = {}
    for item in read_plan().get("strategic_goals") or []:
        if not isinstance(item, dict):
            continue
        goal_id = str(item.get("id") or "").strip()
        if goal_id:
            out[goal_id] = item
    return out


def _complete_template(raw, goals=None):
    """يملأ الحقول الفارغة من الهدف والسجل وصاحب الدور. لا يخترع أرقام قياس."""
    item = dict(raw or {})
    goals = goals or {}
    goal = goals.get(str(item.get("goal_ref") or "").strip()) or {}
    domain = str(item.get("domain") or "").strip()
    item["domain"] = _DOMAIN_ALIAS.get(domain, domain) or str(goal.get("domain") or "").strip()
    if not str(item.get("strategic_goal") or "").strip():
        item["strategic_goal"] = str(goal.get("text") or "").strip()
    if not str(item.get("executive_goal") or "").strip():
        first = ""
        for kpi in goal.get("indicators") or []:
            if isinstance(kpi, dict) and str(kpi.get("kpi") or "").strip():
                first = str(kpi.get("kpi")).strip()
                break
        name = str(item.get("program_name") or item.get("label") or "").strip()
        goal_ref = str(item.get("goal_ref") or "").strip()
        item["executive_goal"] = first or (
            "تنفيذ «%s» وربطه بالهدف %s." % (name, goal_ref) if name and goal_ref else name
        )
    roles = _normalize_roles(item.get("owner_roles"), item.get("owner_role") or "")
    item["owner_roles"] = roles
    if roles:
        item["owner_role"] = roles[0]
    labels = [OWNER_LABELS[role] for role in roles]
    if not str(item.get("implementers") or "").strip():
        item["implementers"] = "، ".join(labels)
    if not str(item.get("target_audience") or "").strip():
        item["target_audience"] = _AUDIENCE_BY_ROLE.get(
            roles[0] if roles else "",
            "المستفيدون وفق اختصاص البرنامج في الخطة المعتمدة",
        )
    if not str(item.get("duration") or "").strip():
        item["duration"] = "موسمي وفق التقويم المدرسي" if item.get("seasonal") else "مستمر طوال العام الدراسي"
    register = REGISTER_LABELS.get(int(item.get("register_id") or 0), "السجل المعتمد")
    name = str(item.get("program_name") or item.get("label") or "البرنامج").strip()
    if not str(item.get("mechanism") or "").strip():
        item["mechanism"] = (
            "1. إعداد خطة تنفيذ «%s» وفق القالب المعتمد وربطها بالمؤشرات المحفوظة.\n"
            "2. تنفيذ الأنشطة في الفترة المحددة وتوثيق الشواهد أولاً بأول.\n"
            "3. إيداع التوثيق في %s ومتابعة صاحب البرنامج حتى الاعتماد."
        ) % (name, register)
    if not str(item.get("success_indicator") or "").strip():
        kpi = str(item.get("kpi_description") or "").strip()
        item["success_indicator"] = kpi or ("اكتمال تنفيذ «%s» وتوثيق شواهده في %s." % (name, register))
    if not str(item.get("risk_management") or "").strip():
        item["risk_management"] = "عند تعثر التنفيذ يُعاد جدولة النشاط ويُوثَّق العائق في السجل مع إجراء بديل معتمد."
    if not str(item.get("budget") or "").strip():
        item["budget"] = "ذاتية"
    if not str(item.get("kpi_description") or "").strip():
        item["kpi_description"] = str(item.get("success_indicator") or "").strip()
    return item


def _indicator_catalog(connection):
    rows = connection.execute(
        """
        SELECT id, code FROM evaluation_indicators
        ORDER BY id
        """
    ).fetchall()
    return {row[0]: row[1] for row in rows}, {row[1]: row[0] for row in rows}


def _algebra_link(connection):
    action = connection.execute(
        """
        SELECT id, title FROM improvement_actions
        WHERE indicator_code = '3-1-1-2'
        ORDER BY sort_order, id
        LIMIT 1
        """
    ).fetchone()
    task = connection.execute(
        """
        SELECT field_path FROM content_overrides
        WHERE role = 'vice_teachers'
          AND field_path LIKE 'tasks.custom.%.title'
          AND value LIKE '%مراجعة الجبر%'
        LIMIT 1
        """
    ).fetchone()
    task_ref = ""
    if task:
        parts = str(task[0]).split(".")
        if len(parts) >= 3:
            task_ref = f"vice_teachers:{parts[1]}.{parts[2]}"
    return {
        "duty_ref": f"improvement:{action[0]}" if action else "",
        "duty_label": str(action[1] or "").strip() if action else "",
        "task_ref": task_ref,
    }


def _ensure_bank_indicator_codes(connection):
    cols = {row[1] for row in connection.execute("PRAGMA table_info(school_programs)")}
    if "bank_indicator_codes" not in cols:
        connection.execute("ALTER TABLE school_programs ADD COLUMN bank_indicator_codes TEXT")
        connection.commit()


def _parse_bank_codes(raw):
    try:
        parsed = json.loads(raw or "[]")
    except json.JSONDecodeError:
        parsed = []
    if not isinstance(parsed, list):
        return []
    codes = []
    for item in parsed:
        code = str(item or "").strip()
        if code and code not in codes:
            codes.append(code)
    return codes


def _as_ids(raw, id_to_code):
    try:
        parsed = json.loads(raw or "[]")
    except json.JSONDecodeError:
        parsed = []
    if not isinstance(parsed, list):
        return [], ""
    ids = []
    for item in parsed:
        if isinstance(item, int) or (isinstance(item, str) and item.isdigit()):
            number = int(item)
            if number in id_to_code and number not in ids:
                ids.append(number)
    codes = [id_to_code[number] for number in ids]
    return ids, "، ".join(codes)


def _normalize_roles(values, fallback=""):
    roles = []
    for item in values or []:
        role = str(item or "").strip()
        if role in OWNER_LABELS and role not in roles:
            roles.append(role)
    if not roles and str(fallback or "").strip() in OWNER_LABELS:
        roles.append(str(fallback).strip())
    return roles


def _roles_from_cell(raw, fallback=""):
    try:
        parsed = json.loads(raw or "[]")
    except json.JSONDecodeError:
        parsed = []
    if not isinstance(parsed, list):
        parsed = []
    return _normalize_roles(parsed, fallback)


def list_programs():
    """كل البرامج المحفوظة. عنوان مرجع الجبر يُقرأ ولا يُنسخ."""
    connection = connect()
    try:
        _ensure_bank_indicator_codes(connection)
        id_to_code, _code_to_id = _indicator_catalog(connection)
        actions = {
            row[0]: str(row[1] or "").strip()
            for row in connection.execute("SELECT id, title FROM improvement_actions")
        }
        rows = connection.execute(
            """
            SELECT id, program_name, strategic_goal, executive_goal, target_audience, duration,
                   implementers, budget, mechanism, success_indicator, risk_management, register_id,
                   owner_role, indicator_ids, status, duty_ref, task_ref, created_at, updated_at,
                   owner_roles, baseline_value, target_value, current_value, unit, kpi_description,
                   goal_ref, domain, level_name, assignee_staff_id, bank_indicator_codes
            FROM school_programs
            WHERE COALESCE(is_deleted, 0) = 0
            ORDER BY id
            """
        ).fetchall()
    finally:
        connection.close()
    programs = []
    for row in rows:
        indicator_ids, indicator_codes = _as_ids(row[13], id_to_code)
        duty_ref = str(row[15] or "").strip()
        duty_label = ""
        if duty_ref.startswith("improvement:"):
            raw = duty_ref.split(":", 1)[1]
            if raw.isdigit():
                duty_label = actions.get(int(raw), "")
        register_id = int(row[11] or 0)
        owner_role = str(row[12] or "").strip()
        owner_roles = _roles_from_cell(row[19] if len(row) > 19 else "", owner_role)
        programs.append({
            "id": row[0],
            "program_name": str(row[1] or "").strip(),
            "strategic_goal": str(row[2] or "").strip(),
            "executive_goal": str(row[3] or "").strip(),
            "target_audience": str(row[4] or "").strip(),
            "duration": str(row[5] or "").strip(),
            "implementers": str(row[6] or "").strip(),
            "budget": str(row[7] or "").strip(),
            "mechanism": str(row[8] or "").strip(),
            "success_indicator": str(row[9] or "").strip(),
            "risk_management": str(row[10] or "").strip(),
            "register_id": register_id,
            "register_label": REGISTER_LABELS.get(register_id, ""),
            "owner_role": owner_roles[0] if owner_roles else owner_role,
            "owner_roles": owner_roles,
            "owner_label": "، ".join(OWNER_LABELS.get(role, "") for role in owner_roles),
            "indicator_ids": indicator_ids,
            "indicator_codes": indicator_codes,
            "bank_indicator_codes": _parse_bank_codes(row[29] if len(row) > 29 else ""),
            "status": str(row[14] or "").strip() or "مسودة",
            "duty_ref": duty_ref,
            "task_ref": str(row[16] or "").strip(),
            "duty_label": duty_label,
            "created_at": str(row[17] or "").strip(),
            "updated_at": str(row[18] or "").strip(),
            "baseline_value": str(row[20] or "").strip() if len(row) > 20 else "",
            "target_value": str(row[21] or "").strip() if len(row) > 21 else "",
            "current_value": str(row[22] or "").strip() if len(row) > 22 else "",
            "unit": str(row[23] or "").strip() if len(row) > 23 else "",
            "kpi_description": str(row[24] or "").strip() if len(row) > 24 else "",
            "goal_ref": str(row[25] or "").strip() if len(row) > 25 else "",
            "domain": str(row[26] or "").strip() if len(row) > 26 else "",
            "level_name": str(row[27] or "").strip() if len(row) > 27 else "",
            "assignee_staff_id": str(row[28] or "").strip() if len(row) > 28 else "",
        })
    return programs


def programs_for_role(role):
    """البرامج الظاهرة على شريحة صاحبها وعلى خطة المدير. المسودة تبقى في الشاشة."""
    return [
        item for item in list_programs()
        if item["status"] in SLIDE_STATUSES and (role == "principal" or role in item["owner_roles"])
    ]


def _phrases_from_rows(rows):
    bank = {}
    for template_key, field_key, phrase in rows:
        bucket = bank.setdefault(str(template_key), {})
        phrases = bucket.setdefault(str(field_key), [])
        text = str(phrase or "").strip()
        if text and text not in phrases:
            phrases.append(text)
    return bank


def list_kpi_options():
    """قوائم خط الأساس والقراءة والمستهدف ووصف المؤشر. الإضافة في الجدول تظهر في الشاشة."""
    connection = connect()
    try:
        rows = connection.execute(
            """
            SELECT list_key, option_value, option_label
            FROM kpi_options
            ORDER BY list_key, sort_order, id
            """
        ).fetchall()
    finally:
        connection.close()
    catalog = {}
    for list_key, value, label in rows:
        catalog.setdefault(str(list_key), []).append({
            "value": str(value or "").strip(),
            "label": str(label or "").strip(),
        })
    return catalog


def list_knowledge():
    """قوائم المجالات والمستويات والفئات وخط الأساس. الإضافة في الجدول تظهر في الشاشة."""
    connection = connect()
    try:
        rows = connection.execute(
            """
            SELECT list_key, option_value, option_label
            FROM knowledge_options
            ORDER BY list_key, sort_order, id
            """
        ).fetchall()
    finally:
        connection.close()
    catalog = {}
    for list_key, value, label in rows:
        catalog.setdefault(str(list_key), []).append({
            "value": str(value or "").strip(),
            "label": str(label or "").strip(),
        })
    return catalog


def list_phrases():
    """بنك الصياغات من الجدول. المفتاح قالب البرنامج ثم الحقل."""
    connection = connect()
    try:
        rows = connection.execute(
            """
            SELECT template_key, field_key, phrase
            FROM program_phrase_bank
            ORDER BY template_key, field_key, sort_order, id
            """
        ).fetchall()
    finally:
        connection.close()
    return _phrases_from_rows(rows)


def add_phrase(template_key, field, phrase):
    """يضيف صياغة إلى جدول program_phrase_bank إن لم تكن موجودة."""
    key = str(template_key or "").strip()
    column = str(field or "").strip()
    text = str(phrase or "").strip()
    if column not in PHRASE_FIELDS:
        raise ValueError("هذا الحقل لا يقبل عبارات")
    if not text:
        raise ValueError("العبارة مطلوبة")
    connection = connect()
    try:
        known = {
            row[0]
            for row in connection.execute("SELECT template_key FROM program_templates")
        }
        if key not in known:
            raise ValueError("اختر قالب البرنامج قبل إضافة العبارة")
        order = connection.execute(
            """
            SELECT COALESCE(MAX(sort_order), 0) + 1
            FROM program_phrase_bank
            WHERE template_key = ? AND field_key = ?
            """,
            (key, column),
        ).fetchone()[0]
        connection.execute(
            """
            INSERT OR IGNORE INTO program_phrase_bank (
                template_key, field_key, phrase, sort_order, created_at
            ) VALUES (?, ?, ?, ?, ?)
            """,
            (key, column, text, order, stamp()),
        )
        connection.commit()
        rows = connection.execute(
            """
            SELECT template_key, field_key, phrase
            FROM program_phrase_bank
            ORDER BY template_key, field_key, sort_order, id
            """
        ).fetchall()
    finally:
        connection.close()
    return _phrases_from_rows(rows)


def template_payload():
    """قوالب البرنامج من الجدول. أرقام المؤشرات تُستبدل بمعرفاتها المحفوظة."""
    connection = connect()
    try:
        _id_to_code, code_to_id = _indicator_catalog(connection)
        link = _algebra_link(connection)
        goals = _goal_map()
        rows = connection.execute(
            """
            SELECT template_key, label, program_name, strategic_goal, executive_goal,
                   target_audience, duration, implementers, budget, mechanism,
                   success_indicator, risk_management, register_id, owner_role, indicator_codes,
                   owner_roles, goal_ref
            FROM program_templates
            ORDER BY sort_order, id
            """
        ).fetchall()
    finally:
        connection.close()
    templates = []
    for row in rows:
        try:
            codes = json.loads(row[14] or "[]")
        except json.JSONDecodeError:
            codes = []
        if not isinstance(codes, list):
            codes = []
        key = str(row[0] or "").strip()
        owner_role = str(row[13] or "").strip()
        owner_roles = _roles_from_cell(row[15] if len(row) > 15 else "", owner_role)
        bank = TEMPLATE_BY_KEY.get(key) or {}
        if not codes:
            codes = list(bank.get("indicator_codes") or [])
        if not owner_roles:
            owner_roles = _normalize_roles(bank.get("owner_roles"), bank.get("owner_role") or owner_role)
        item = {
            "key": key,
            "label": str(row[1] or "").strip() or str(bank.get("label") or ""),
            "program_name": str(row[2] or "").strip() or str(bank.get("program_name") or ""),
            "strategic_goal": str(row[3] or "").strip() or str(bank.get("strategic_goal") or ""),
            "executive_goal": str(row[4] or "").strip() or str(bank.get("executive_goal") or ""),
            "target_audience": str(row[5] or "").strip() or str(bank.get("target_audience") or ""),
            "duration": str(row[6] or "").strip() or str(bank.get("duration") or ""),
            "implementers": str(row[7] or "").strip() or str(bank.get("implementers") or ""),
            "budget": str(row[8] or "").strip() or str(bank.get("budget") or ""),
            "mechanism": str(row[9] or "").strip() or str(bank.get("mechanism") or ""),
            "success_indicator": str(row[10] or "").strip() or str(bank.get("success_indicator") or ""),
            "risk_management": str(row[11] or "").strip() or str(bank.get("risk_management") or ""),
            "register_id": int(row[12] or 0) or int(bank.get("register_id") or 0),
            "owner_role": owner_roles[0] if owner_roles else owner_role,
            "owner_roles": owner_roles,
            "indicator_codes": codes,
            "indicator_ids": [code_to_id[code] for code in codes if code in code_to_id],
            "goal_ref": (str(row[16] or "").strip() if len(row) > 16 else "") or str(bank.get("goal_ref") or ""),
            "domain": str(bank.get("domain") or ""),
            "level_name": str(bank.get("level_name") or ""),
            "baseline_value": str(bank.get("baseline_value") or ""),
            "current_value": str(bank.get("current_value") or ""),
            "target_value": str(bank.get("target_value") or ""),
            "unit": str(bank.get("unit") or ""),
            "kpi_description": str(bank.get("kpi_description") or ""),
        }
        if key == "loss":
            item["duty_ref"] = link["duty_ref"]
            item["task_ref"] = link["task_ref"]
            item["duty_label"] = link["duty_label"]
        else:
            item["duty_ref"] = ""
            item["task_ref"] = ""
            item["duty_label"] = ""
        templates.append(_complete_template(item, goals))
    return templates


def sync_program_templates(connection=None):
    """يحدّث قوالب البرامج من TEMPLATES ويضيف الناقص دون حذف محفوظ المستخدم في school_programs."""
    own = connection is None
    if own:
        connection = connect()
    try:
        _ensure_owner_roles_columns(connection)
        known = {
            str(row[0]): row[1]
            for row in connection.execute("SELECT template_key, id FROM program_templates")
        }
        for index, item in enumerate(TEMPLATES, start=1):
            key = item["key"]
            roles = _normalize_roles(item.get("owner_roles"), item.get("owner_role") or "")
            values = (
                item.get("label") or "",
                item.get("program_name") or "",
                item.get("strategic_goal") or "",
                item.get("executive_goal") or "",
                item.get("target_audience") or "",
                item.get("duration") or "",
                item.get("implementers") or "",
                item.get("budget") or "",
                item.get("mechanism") or "",
                item.get("success_indicator") or "",
                item.get("risk_management") or "",
                int(item.get("register_id") or 0),
                roles[0] if roles else (item.get("owner_role") or ""),
                json.dumps(item.get("indicator_codes") or [], ensure_ascii=False),
                json.dumps(roles, ensure_ascii=False),
                item.get("goal_ref") or "",
                index,
            )
            if key in known:
                connection.execute(
                    """
                    UPDATE program_templates
                    SET label = ?, program_name = ?, strategic_goal = ?, executive_goal = ?,
                        target_audience = ?, duration = ?, implementers = ?, budget = ?,
                        mechanism = ?, success_indicator = ?, risk_management = ?,
                        register_id = ?, owner_role = ?, indicator_codes = ?, owner_roles = ?,
                        goal_ref = ?, sort_order = ?
                    WHERE template_key = ?
                    """,
                    (*values, key),
                )
            else:
                connection.execute(
                    """
                    INSERT INTO program_templates (
                        template_key, label, program_name, strategic_goal, executive_goal,
                        target_audience, duration, implementers, budget, mechanism,
                        success_indicator, risk_management, register_id, owner_role,
                        indicator_codes, owner_roles, goal_ref, sort_order
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (key, *values),
                )
        if own:
            connection.commit()
    finally:
        if own:
            connection.close()


def _require(value, label):
    if not str(value or "").strip():
        raise ValueError(f"{label} مطلوب")


def _next_status(requested, current):
    status = requested if requested in STATUSES else (current or "مسودة")
    if status == "معتمد" and current != "معتمد":
        return current or "مسودة"
    if (current or "مسودة") == "مسودة" and status in {"قيد التنفيذ", "مكتمل", "متعثر"}:
        return "مسودة"
    return status


def _dedupe_school_programs(connection):
    """يبقي أقدم صف لكل اسم برنامج ويحذف التكرار."""
    rows = connection.execute(
        """
        SELECT id, program_name FROM school_programs
        WHERE COALESCE(is_deleted, 0) = 0
        ORDER BY id
        """
    ).fetchall()
    seen = {}
    drop = []
    for pid, name in rows:
        key = str(name or "").strip()
        if not key:
            continue
        if key in seen:
            drop.append(int(pid))
        else:
            seen[key] = int(pid)
    for pid in drop:
        connection.execute(
            "UPDATE school_programs SET is_deleted = 1 WHERE id = ?",
            (pid,),
        )
    return len(drop)


def ensure_school_programs_from_templates(connection=None):
    """يزرع كل TEMPLATES الناقصة في school_programs ويحدّث الحقول الفارغة دون كسر المعتمد."""
    own = connection is None
    if own:
        connection = connect()
    report = {"deduped": 0, "inserted": 0, "filled": 0, "total_templates": len(TEMPLATES)}
    try:
        sync_program_templates(connection)
        report["deduped"] = _dedupe_school_programs(connection)
        id_to_code, code_to_id = _indicator_catalog(connection)
        goals = _goal_map()
        existing = {
            str(row[1] or "").strip(): row
            for row in connection.execute(
                """
                SELECT id, program_name, strategic_goal, executive_goal, target_audience, duration,
                       implementers, budget, mechanism, success_indicator, risk_management,
                       register_id, owner_role, indicator_ids, status, owner_roles,
                       baseline_value, target_value, unit, kpi_description, goal_ref, domain, level_name
                FROM school_programs
                """
            ).fetchall()
        }
        moment = stamp()
        for raw in TEMPLATES:
            item = _complete_template(raw, goals)
            name = str(item.get("program_name") or "").strip()
            if not name:
                continue
            roles = _normalize_roles(item.get("owner_roles"), item.get("owner_role") or "")
            if not roles:
                continue
            indicator_ids = []
            for code in item.get("indicator_codes") or []:
                number = code_to_id.get(str(code))
                if number and number not in indicator_ids:
                    indicator_ids.append(number)
            unit = str(item.get("unit") or "").strip()
            if unit not in UNITS:
                unit = ""
            payload = {
                "strategic_goal": item.get("strategic_goal") or "",
                "executive_goal": item.get("executive_goal") or "",
                "target_audience": item.get("target_audience") or "",
                "duration": item.get("duration") or "",
                "implementers": item.get("implementers") or "",
                "budget": item.get("budget") or "",
                "mechanism": item.get("mechanism") or "",
                "success_indicator": item.get("success_indicator") or "",
                "risk_management": item.get("risk_management") or "",
                "register_id": int(item.get("register_id") or 0),
                "owner_role": roles[0],
                "owner_roles": json.dumps(roles, ensure_ascii=False),
                "indicator_ids": json.dumps(indicator_ids),
                "baseline_value": str(item.get("baseline_value") or ""),
                "target_value": str(item.get("target_value") or ""),
                "unit": unit,
                "kpi_description": item.get("kpi_description") or "",
                "goal_ref": item.get("goal_ref") or "",
                "domain": item.get("domain") or "",
                "level_name": item.get("level_name") or "",
            }
            if name not in existing:
                connection.execute(
                    """
                    INSERT INTO school_programs (
                        program_name, strategic_goal, executive_goal, target_audience, duration,
                        implementers, budget, mechanism, success_indicator, risk_management,
                        register_id, owner_role, indicator_ids, status, duty_ref, task_ref,
                        created_at, updated_at, owner_roles, baseline_value, target_value,
                        current_value, unit, kpi_description, goal_ref, domain, level_name
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '', '', ?, ?, ?, ?, ?, '', ?, ?, ?, ?, ?)
                    """,
                    (
                        name,
                        payload["strategic_goal"],
                        payload["executive_goal"],
                        payload["target_audience"],
                        payload["duration"],
                        payload["implementers"],
                        payload["budget"],
                        payload["mechanism"],
                        payload["success_indicator"],
                        payload["risk_management"],
                        payload["register_id"],
                        payload["owner_role"],
                        payload["indicator_ids"],
                        "مسودة",
                        moment,
                        moment,
                        payload["owner_roles"],
                        payload["baseline_value"],
                        payload["target_value"],
                        payload["unit"],
                        payload["kpi_description"],
                        payload["goal_ref"],
                        payload["domain"],
                        payload["level_name"],
                    ),
                )
                report["inserted"] += 1
                continue
            row = existing[name]
            # املأ الحقول الفارغة فقط — لا تستبدل نصاً محفوظاً
            updates = []
            values = []
            field_map = [
                (2, "strategic_goal"),
                (3, "executive_goal"),
                (4, "target_audience"),
                (5, "duration"),
                (6, "implementers"),
                (7, "budget"),
                (8, "mechanism"),
                (9, "success_indicator"),
                (10, "risk_management"),
                (16, "baseline_value"),
                (17, "target_value"),
                (18, "unit"),
                (19, "kpi_description"),
                (20, "goal_ref"),
                (21, "domain"),
                (22, "level_name"),
            ]
            for idx, key in field_map:
                current = str((row[idx] if idx < len(row) else "") or "").strip()
                desired = str(payload.get(key) or "").strip()
                if key == "domain" and current in _DOMAIN_ALIAS:
                    current = ""
                if not current and desired:
                    updates.append(f"{key} = ?")
                    values.append(desired)
            if not str(row[15] or "").strip() and payload["owner_roles"]:
                updates.append("owner_roles = ?")
                values.append(payload["owner_roles"])
            if (not str(row[13] or "").strip() or str(row[13]).strip() in {"[]", "null"}) and indicator_ids:
                updates.append("indicator_ids = ?")
                values.append(payload["indicator_ids"])
            if updates:
                updates.append("updated_at = ?")
                values.append(moment)
                values.append(int(row[0]))
                connection.execute(
                    f"UPDATE school_programs SET {', '.join(updates)} WHERE id = ?",
                    values,
                )
                report["filled"] += 1
        if own:
            connection.commit()
        report["programs_now"] = connection.execute(
            "SELECT COUNT(*) FROM school_programs"
        ).fetchone()[0]
        report["names"] = [
            str(r[0])
            for r in connection.execute(
                "SELECT program_name FROM school_programs ORDER BY id"
            ).fetchall()
        ]
        return report
    finally:
        if own:
            connection.close()


def save_program(body):
    """يحفظ المسودة أو يحدّث البرنامج. الاعتماد مسار مستقل."""
    name = body.program_name.strip()
    _require(name, "اسم البرنامج")
    _require(body.target_audience, "المستهدفون")
    _require(body.duration, "الفترة الزمنية")
    _require(body.implementers, "المنفذون")
    _require(body.mechanism, "آلية التنفيذ")
    _require(body.success_indicator, "مؤشر النجاح")
    if body.register_id not in REGISTER_LABELS:
        raise ValueError("السجل يجب أن يكون من السجلات الستة")
    owner_roles = _normalize_roles(getattr(body, "owner_roles", None), body.owner_role)
    if not owner_roles:
        raise ValueError("صاحب البرنامج يجب أن يكون من الأدوار الخمسة")
    assignee_staff_id = str(getattr(body, "assignee_staff_id", "") or "").strip()
    unit = str(getattr(body, "unit", "") or "").strip()
    if unit not in UNITS:
        raise ValueError("وحدة المؤشر تكون % أو عدد أو نسبة")
    goal_ref = str(getattr(body, "goal_ref", "") or "").strip()
    if goal_ref:
        from .operational_plan import goal_ids
        if goal_ref not in goal_ids():
            raise ValueError("الهدف الاستراتيجي غير موجود في الخطة التشغيلية")
    domain = str(getattr(body, "domain", "") or "").strip()
    level_name = str(getattr(body, "level_name", "") or "").strip()
    knowledge = list_knowledge()
    if domain and domain not in {item["value"] for item in knowledge.get("domain", [])}:
        raise ValueError("المجال يجب أن يكون من المجالات الأربعة")
    if level_name and level_name not in {item["value"] for item in knowledge.get("level", [])}:
        raise ValueError("المستوى يجب أن يكون من المستويات الأربعة")
    connection = connect()
    try:
        _ensure_bank_indicator_codes(connection)
        id_to_code, code_to_id = _indicator_catalog(connection)
        indicator_ids = []
        for item in body.indicator_ids:
            number = int(item)
            if number not in id_to_code:
                raise ValueError("أحد المؤشرات غير موجود في السجل")
            if number not in indicator_ids:
                indicator_ids.append(number)
        bank_codes = []
        for item in getattr(body, "indicator_codes", None) or []:
            code = str(item or "").strip()
            if not code:
                continue
            if code not in bank_codes:
                bank_codes.append(code)
            mapped = code_to_id.get(code)
            if mapped and mapped not in indicator_ids:
                indicator_ids.append(mapped)
        if not bank_codes and body.id:
            previous_bank = connection.execute(
                "SELECT bank_indicator_codes FROM school_programs WHERE id = ?",
                (body.id,),
            ).fetchone()
            if previous_bank:
                bank_codes = _parse_bank_codes(previous_bank[0])
        if assignee_staff_id:
            staff = connection.execute(
                "SELECT national_id FROM noor_staff WHERE national_id = ?",
                (assignee_staff_id,),
            ).fetchone()
            if not staff:
                raise ValueError("المكلَّف غير موجود في سجل المنسوبين")
        current_status = "مسودة"
        if body.id:
            current = connection.execute(
                "SELECT status, duty_ref, task_ref, created_at FROM school_programs WHERE id = ?",
                (body.id,),
            ).fetchone()
            if not current:
                raise ValueError("البرنامج غير موجود")
            current_status = str(current[0] or "مسودة")
            duty_ref = str(current[1] or "")
            task_ref = str(current[2] or "")
            created_at = str(current[3] or "") or stamp()
        else:
            duty_ref = body.duty_ref.strip()
            task_ref = body.task_ref.strip()
            created_at = stamp()
        status = _next_status(body.status.strip(), current_status)
        moment = stamp()
        values = (
            name,
            body.strategic_goal.strip(),
            body.executive_goal.strip(),
            body.target_audience.strip(),
            body.duration.strip(),
            body.implementers.strip(),
            body.budget.strip(),
            body.mechanism.strip(),
            body.success_indicator.strip(),
            body.risk_management.strip(),
            body.register_id,
            owner_roles[0],
            json.dumps(indicator_ids),
            status,
            duty_ref,
            task_ref,
            created_at,
            moment,
            json.dumps(owner_roles, ensure_ascii=False),
            str(getattr(body, "baseline_value", "") or "").strip(),
            str(getattr(body, "target_value", "") or "").strip(),
            str(getattr(body, "current_value", "") or "").strip(),
            unit,
            str(getattr(body, "kpi_description", "") or "").strip(),
            goal_ref,
            domain,
            level_name,
            assignee_staff_id,
            json.dumps(bank_codes, ensure_ascii=False),
        )
        if body.id:
            connection.execute(
                """
                UPDATE school_programs
                SET program_name = ?, strategic_goal = ?, executive_goal = ?, target_audience = ?,
                    duration = ?, implementers = ?, budget = ?, mechanism = ?, success_indicator = ?,
                    risk_management = ?, register_id = ?, owner_role = ?, indicator_ids = ?, status = ?,
                    duty_ref = ?, task_ref = ?, created_at = ?, updated_at = ?, owner_roles = ?,
                    baseline_value = ?, target_value = ?, current_value = ?, unit = ?, kpi_description = ?,
                    goal_ref = ?, domain = ?, level_name = ?, assignee_staff_id = ?,
                    bank_indicator_codes = ?
                WHERE id = ?
                """,
                (*values, body.id),
            )
        else:
            connection.execute(
                """
                INSERT INTO school_programs (
                    program_name, strategic_goal, executive_goal, target_audience, duration, implementers,
                    budget, mechanism, success_indicator, risk_management, register_id, owner_role,
                    indicator_ids, status, duty_ref, task_ref, created_at, updated_at, owner_roles,
                    baseline_value, target_value, current_value, unit, kpi_description, goal_ref,
                    domain, level_name, assignee_staff_id, bank_indicator_codes
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                values,
            )
        connection.commit()
    finally:
        connection.close()
    return list_programs()


def approve_program(program_id):
    """اعتماد المدير: المسودة وحدها تنتقل إلى معتمد."""
    connection = connect()
    try:
        current = connection.execute(
            "SELECT status FROM school_programs WHERE id = ?",
            (program_id,),
        ).fetchone()
        if not current:
            raise ValueError("البرنامج غير موجود")
        if str(current[0] or "") != "مسودة":
            raise ValueError("الاعتماد يكون للمسودة فقط")
        connection.execute(
            "UPDATE school_programs SET status = ?, updated_at = ? WHERE id = ?",
            ("معتمد", stamp(), program_id),
        )
        connection.commit()
    finally:
        connection.close()
    return list_programs()
