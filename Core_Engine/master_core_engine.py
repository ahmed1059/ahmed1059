import datetime
import hashlib
import json

class SchoolDataIngestionEngine1059:
    """
    العقل المدبر لـ 'متوسطة سعد بن الربيع الأنصاري' بالمدينة المنورة لعام 1448هـ
    محرك تفكيك وضخ ملفات نور وبناء الحسابات والخطط وفق بروتوكول 1059 الصارم
    """
    def __init__(self):
        self.school_name = "متوسطة سعد بن الربيع الأنصاري"
        self.region = "المدينة المنورة"
        self.stage = "متوسط"
        self.gender = "بنين"
        
    def get_regional_calendar_locked(self):
        """
        قفل التواريخ الجغرافية لعام 1448هـ / 2026م للمنطقة الغربية لمنع تداخل التقارير
        الدراسة تبدأ في 17 ربيع الأول 1448هـ الموافق 30 أغسطس 2026م (18 أسبوعاً)
        """
        start_date = datetime.date(2026, 8, 30)
        total_weeks = 18
        return start_date, total_weeks

    def secure_access_hash(self, national_id, salt="1059_MEDINA_SECURE"):
        """
        تشفير سيبراني رقمي للسجل المدني ليكون جدار الحماية لحساب الموظف على الويب
        """
        cipher_input = (str(national_id) + salt).encode('utf-8')
        return hashlib.sha256(cipher_input).hexdigest()

    def process_ai_stage_tasks(self, role):
        """
        ضخ تلقائي متوقع للبرامج الوزارية المعتمدة للمرحلة المتوسطة واختبارات نافس الوطنية
        """
        tasks_matrix = {
            "مدير مدرسة": [
                "بناء الخطة التشغيلية والإجرائية السنوية لمتوسطة سعد بن الربيع الأنصاري",
                "متابعة جاهزية الكوادر والتسجيل في الاختبارات الوطنية (نافس)",
                "حوكمة بنود الصرف للميزانية التشغيلية والمشتريات لجان التميز والجودة"
            ],
            "وكيل": [
                "جدولة خطة الزيارات الصفية والتقويمية للمعلمين وحصر الحصص",
                "تفعيل مجتمعات التعلم المهنية PLCs ومتابعة التحضير الرقمي بمدرستي",
                "الإشراف على لجان سير الاختبارات وأعمال الكنترول والرصد في نور"
            ],
            "موجه طلابي": [
                "تفعيل خطة الانضباط المدرسي والحد من الغياب في الأسابيع المستهدفة",
                "تنفيذ برامج رعاية الطلاب المتفوقين ودعم حالات تدني التحصيل دراسياً",
                "تطبيق قواعد السلوك والمواظبة الوزارية المعتمدة لحالات المراهقة"
            ],
            "رائد النشاط": [
                "تنفيذ فعاليات أسبوع الاحتفاء باليوم الوطني السعودي ويوم التأسيس",
                "تنظيم جدول الإذاعة المدرسية والمسابقات الثقافية والأنشطة الرياضية",
                "تفعيل برامج الشراكة المجتمعية (ارتقاء) وتوثيق شواهد العمل التطوعي"
            ]
        }
        return tasks_matrix.get(role, ["متابعة البيئة التعليمية والأكاديمية للمدرسة"])

    def process_raw_nor_payload(self):
        """
        معالجة صلب بيانات الكادر القيادي والتعليمي المستخلص من ملفات نور المرفوعة دقيقة بدقة
        """
        # الهيكلة الفعلية المستخلصة من عينات الملفات الثمانية المرفوعة
        nor_records = [
            {"name": "نايف بن سمير حجيف المخلفي", "national_id": "1046940365", "role": "مدير مدرسة", "specialty": "أحياء"},
            {"name": "خالد بن علي بن حجري العمري", "national_id": "1000741209", "role": "وكيل", "specialty": "عربي"},
            {"name": "محمد بن فايز بن هلال الحربي", "national_id": "1060852900", "role": "وكيل", "specialty": "عربي"},
            {"name": "فهد حنيف بن محمد العمري", "national_id": "1053394563", "role": "موجه طلابي", "specialty": "عربي"},
            {"name": "منور بن محمد بن عليان اللهيبي", "national_id": "1048036600", "role": "موجه طلابي", "specialty": "عربي"},
            {"name": "محمد حامد عماش السهلي", "national_id": "1083157642", "role": "رائد النشاط", "specialty": "دين"},
            {"name": "عبدالمجيد محمد رميزان المرواني", "national_id": "1036307674", "role": "إداري", "specialty": "دعوة"},
            {"name": "احمد بن صالح بن رجاء العوفي", "national_id": "1009058346", "role": "أمين مصادر تعلم", "specialty": "محضر معمل حاسب"}
        ]
        
        start_date, total_weeks = self.get_regional_calendar_locked()
        compiled_master_payload = {"school": self.school_name, "meta_configuration": [], "roles_plans": {}}
        
        for staff in nor_records:
            role = staff['role']
            name = staff['name']
            
            compiled_master_payload["roles_plans"][role] = {
                "owner": name,
                "login_username_nid": staff['national_id'],
                "secure_token": self.secure_access_hash(staff['national_id']),
                "preface": f"كلمة قيادية بقلم {role}: نلتزم بتطوير ممارسات التعليم والتعلم والتقويم الذاتي لرفع كفاءة المنشأة.",
                "weekly_schedule_landscape": [],
                "signature_bloc": {
                    "prepared": f"إعداد صاحب العلاقة: {name} ({role})",
                    "approved": "اعتماد مدير المدرسة: القيادة المدرسية نايف بن سمير حجيف المخلفي",
                    "css_lock": "page-break-inside: avoid; margin-top: 40px;"
                }
            }
            
            # محرك توزيع التواريخ والأسابيع الـ 18 الفعلي لمنطقة المدينة المنورة لعام 1448هـ
            targeted_tasks = self.process_ai_stage_tasks(role)
            for w in range(1, total_weeks + 1):
                w_start = start_date + datetime.timedelta(weeks=w-1)
                w_end = w_start + datetime.timedelta(days=4)
                date_label = f"من {w_start.strftime('%Y-%m-%d')} إلى {w_end.strftime('%Y-%m-%d')}"
                
                compiled_master_payload["roles_plans"][role]["weekly_schedule_landscape"].append({
                    "week_index": w,
                    "date_span": date_label,
                    "tasks": targeted_tasks,
                    "allow_inline_append": True,
                    "auto_save_interval_ms": 500
                })
                
        return compiled_master_payload

# تشغيل وتوليد الكائن الهيكلي الجاهز للحقن الفوري
engine = SchoolDataIngestionEngine1059()
final_json_payload = engine.process_raw_nor_payload()
