# خريطة xAPI المقترحة

يمكن ربط سجل learning_events لاحقًا بمخزن LRS عبر تحويل الأحداث إلى xAPI Statements.

| حدث تمكّن | xAPI Verb مقترح | Object |
|---|---|---|
| lesson_open | initialized | lesson |
| diagnostic_answer | answered | diagnostic item |
| activity_complete | interacted | activity |
| mastery_answer | answered | mastery item |
| lesson_mastered | mastered | lesson |
| lesson_support_needed | experienced | remediation route |
| lesson_close | terminated | lesson |

## مثال
```json
{
  "actor": {"account": {"homePage": "https://tamakkun.example", "name": "S3A001"}},
  "verb": {"id": "http://adlnet.gov/expapi/verbs/mastered", "display": {"ar": "أتقن"}},
  "object": {"id": "https://tamakkun.example/lessons/U1-10", "definition": {"name": {"ar": "الحال"}}},
  "result": {"score": {"scaled": 1.0}, "success": true, "completion": true}
}
```

ملاحظة: لا يرسل النظام الحالي بيانات الطلاب إلى LRS خارجي. هذا الملف يحدد خريطة تكامل مستقبلية فقط.
