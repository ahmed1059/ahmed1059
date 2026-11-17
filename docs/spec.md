# spec.md — ãäÙæãÉ ÇáÎØØ ÇáãÏÑÓíÉ ÇáĞßíÉ

## 1. ÇáãáÎÕ
ãäÙæãÉ æíÈ ÊÍæá ãáİ Excel ãä äæÑ Åáì ßÊíÈ A4 Landscape íÍÊæí 22+ ÎØÉ ãÏÑÓíÉ.

## 2. Stack
- Backend: Python 3.11+ / FastAPI / SQLite
- Frontend: HTML5 + CSS3 + Vanilla JS
- Fonts: Cairo, Tajawal, Amiri, Dubai, Almarai, Kufam (ãÍáíÉ)

## 3. ÈäíÉ ÇáãÌáÏÇÊ
Core_Engine/  - FastAPI + ãäØŞ ÇáÃÚãÇá
Print_Canvas/ - ÇáæÇÌåÇÊ + CSS + JS + ÇáÎØæØ
School_Data/  - Excel + ÇáÔÚÇÑÇÊ + ŞÇÚÏÉ ÇáÈíÇäÇÊ
docs/         - spec.md
.cursor/      - rules

## 4. ÌÏæá Users
id, national_id, name, role, specialty, password_hash, school_id, failed_attempts, locked_until

## 5. ÌÏæá Schools
id, name, region, stage, gender, logo_path, theme, font, academic_year

## 6. ÌÏæá Calendars
id, region, semester, week_number, start_date, end_date, hijri_start, hijri_end

## 7. ÌÏæá Task_Bank
id, task_code, title, role, stage, week_target, semester, execution_method, execution_time, evidence, category

## 8. ÌÏæá Plans
id, school_id, user_id, plan_type, week_number, content (JSON), created_at, updated_at

## 9. ÇáÃÏæÇÑ
principal, vice_teachers, vice_students, activity_leader, gifted_coordinator, student_counselor, health_guide, safety_officer, teacher

## 10. ÇáãäÇØŞ
ÇáãÏíäÉ ÇáãäæÑÉ, ãßÉ ÇáãßÑãÉ, ÌÏÉ, ÇáØÇÆİ, ÇáÑíÇÖ

## 11. ãÍÑß ÇáØÈÇÚÉ
A4 Landscape, page-break-inside: avoid, ÊßÑÇÑ ÇáÊÑæíÓÉ æÇáÊĞííá.
ßÊíÈ: ÛáÇİ ? ÈÓãáÉ ? ãÑÊßÒÇÊ ? ßáãÉ ? ÌÏÇæá.
