var schoolOccasions = [
    { id: "occ-1448-admin", year: "1448-1449", title: "عودة المشرفين التربويين والإداريين", hijriStart: "28/02/1448", hijriEnd: "", gregorianStart: "11/08/2026", gregorianEnd: "", type: "admin", scope: "all", anchor: "", note: "الثلاثاء" },
    { id: "occ-1448-teachers", year: "1448-1449", title: "عودة المعلمين الممارسين للتدريس", hijriStart: "03/03/1448", hijriEnd: "", gregorianStart: "16/08/2026", gregorianEnd: "", type: "teachers", scope: "all", anchor: "", note: "الأحد" },
    { id: "occ-1448-study-general", year: "1448-1449", title: "انطلاق الدراسة للطلاب", hijriStart: "10/03/1448", hijriEnd: "", gregorianStart: "23/08/2026", gregorianEnd: "", type: "academic", scope: "general", anchor: "yearStart", note: "معظم المناطق" },
    { id: "occ-1448-study-makkah", year: "1448-1449", title: "انطلاق الدراسة للطلاب", hijriStart: "17/03/1448", hijriEnd: "", gregorianStart: "30/08/2026", gregorianEnd: "", type: "academic", scope: "makkah", anchor: "yearStart", note: "مكة والمدينة وجدة والطائف" },
    { id: "occ-1448-national-day", year: "1448-1449", title: "إجازة اليوم الوطني السعودي", hijriStart: "12/04/1448", hijriEnd: "13/04/1448", gregorianStart: "23/09/2026", gregorianEnd: "24/09/2026", type: "holiday", scope: "all", anchor: "", note: "تم تفعيلها بنجاح" },
    { id: "occ-1448-mawhiba", year: "1448-1449", title: "فترة تسجيل مقياس موهبة للقدرات العقلية", hijriStart: "19/03/1448", hijriEnd: "12/05/1448", gregorianStart: "01/10/2026", gregorianEnd: "23/10/2026", type: "measurement", scope: "all", anchor: "", note: "التسجيل متاح حالياً عبر بوابة قياس" },
    { id: "occ-1448-teacher-day", year: "1448-1449", title: "اليوم العالمي للمعلم", hijriStart: "21/04/1448", hijriEnd: "", gregorianStart: "05/10/2026", gregorianEnd: "", type: "activity", scope: "all", anchor: "", note: "فعاليات تقدير المعلمين بالمدارس" },
    { id: "occ-1448-tolerance", year: "1448-1449", title: "اليوم الدولي للتسامح", hijriStart: "06/05/1448", hijriEnd: "", gregorianStart: "16/11/2026", gregorianEnd: "", type: "activity", scope: "all", anchor: "", note: "برامج توعوية لرفض التنمر" },
    { id: "occ-1448-child", year: "1448-1449", title: "اليوم العالمي للطفل", hijriStart: "10/05/1448", hijriEnd: "", gregorianStart: "20/11/2026", gregorianEnd: "", type: "activity", scope: "all", anchor: "", note: "الإذاعة المدرسية وحقوق الطفل" },
    { id: "occ-1448-autumn", year: "1448-1449", title: "إجازة الخريف الرسمية", hijriStart: "10/06/1448", hijriEnd: "18/06/1448", gregorianStart: "20/11/2026", gregorianEnd: "28/11/2026", type: "holiday", scope: "all", anchor: "", note: "إجازة فصلية متواصلة لمدة 9 أيام" },
    { id: "occ-1448-exam-1", year: "1448-1449", title: "اختبارات نهاية الفصل الدراسي الأول", hijriStart: "26/06/1448", hijriEnd: "07/07/1448", gregorianStart: "06/12/2026", gregorianEnd: "17/12/2026", type: "exam", scope: "all", anchor: "examStart", note: "تشمل التحريري وأعمال السنة" },
    { id: "occ-1448-arabic", year: "1448-1449", title: "اليوم العالمي للغة العربية", hijriStart: "08/07/1448", hijriEnd: "", gregorianStart: "18/12/2026", gregorianEnd: "", type: "activity", scope: "all", anchor: "", note: "معارض ومسابقات الخط العربي" },
    { id: "occ-1448-midyear", year: "1448-1449", title: "إجازة منتصف العام الدراسي", hijriStart: "30/07/1448", hijriEnd: "08/08/1448", gregorianStart: "08/01/2027", gregorianEnd: "16/01/2027", type: "holiday", scope: "all", anchor: "", note: "فترة راحة بعد نهاية الفصل الأول" },
    { id: "occ-1448-term-2", year: "1448-1449", title: "بداية الدراسة للفصل الدراسي الثاني", hijriStart: "09/08/1448", hijriEnd: "", gregorianStart: "17/01/2027", gregorianEnd: "", type: "academic", scope: "all", anchor: "", note: "عودة الطلاب للمقاعد الدراسية" },
    { id: "occ-1448-founding", year: "1448-1449", title: "إجازة يوم التأسيس", hijriStart: "12/09/1448", hijriEnd: "15/09/1448", gregorianStart: "19/02/2027", gregorianEnd: "22/02/2027", type: "holiday", scope: "all", anchor: "", note: "إجازة وطنية ممتدة" },
    { id: "occ-1448-fitr", year: "1448-1449", title: "إجازة عيد الفطر المبارك", hijriStart: "19/09/1448", hijriEnd: "", gregorianStart: "26/02/2027", gregorianEnd: "", type: "holiday", scope: "all", anchor: "", note: "تبدأ بنهاية دوام 18 رمضان، والعودة للدراسة الأحد 14 مارس" },
    { id: "occ-1448-flag", year: "1448-1449", title: "يوم العلم السعودي", hijriStart: "04/10/1448", hijriEnd: "", gregorianStart: "11/03/2027", gregorianEnd: "", type: "national", scope: "all", anchor: "", note: "تفعيل قيم الولاء والاعتزاز بالراية" },
    { id: "occ-1448-adha", year: "1448-1449", title: "إجازة عيد الأضحى المبارك", hijriStart: "01/12/1448", hijriEnd: "16/12/1448", gregorianStart: "07/05/2027", gregorianEnd: "22/05/2027", type: "holiday", scope: "all", anchor: "", note: "العودة للدراسة الأحد 23 مايو" },
    { id: "occ-1448-exam-2", year: "1448-1449", title: "اختبارات نهاية الفصل الدراسي الثاني", hijriStart: "15/01/1449", hijriEnd: "18/01/1449", gregorianStart: "20/06/2027", gregorianEnd: "23/06/2027", type: "exam", scope: "all", anchor: "", note: "الاختبارات النهائية الختامية" },
    { id: "occ-1448-summer", year: "1448-1449", title: "بداية إجازة نهاية العام الدراسي", hijriStart: "19/01/1449", hijriEnd: "", gregorianStart: "24/06/2027", gregorianEnd: "", type: "holiday", scope: "all", anchor: "yearEnd", note: "نهاية العام الدراسي لجميع المناطق" }
];

function occasionVisible(item, region) {
    return item.scope === "all" || item.scope === region;
}

function occasionsFor(year, region) {
    return schoolOccasions.filter(function (item) {
        return item.year === year && occasionVisible(item, region);
    });
}

function occasionAnchors(region) {
    var anchors = { yearStart: null, examStart: null, yearEnd: null };
    schoolOccasions.forEach(function (item) {
        if (!item.anchor || !occasionVisible(item, region)) {
            return;
        }
        anchors[item.anchor] = item;
    });
    return anchors;
}

window.schoolOccasions = schoolOccasions;
window.occasionsFor = occasionsFor;
window.occasionAnchors = occasionAnchors;
