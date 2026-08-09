# دليل النشر الشامل لتطبيق إدارة السكن والعمالة (Next.js) 🚀

هذا الدليل يشرح أفضل الطرق لنشر تطبيقك وإتاحته للمستخدمين بأعلى كفاءة وأقل تكلفة، مع حل مشكلة قيود الحجم التي ظهرت لك في **Cloudflare Workers**.

---

## 📋 نظرة عامة وتقييم الخيارات

| المنصة | التكلفة | حد الحجم (Size Limit) | التوافق مع Next.js | التوصية |
| :--- | :--- | :--- | :--- | :--- |
| **Google Cloud Run** | مجاني تقريباً (Free Tier) | ⚠️ لا يوجد حد (يدعم حتى 32GB) | 100% (كامل المميزات) | ⭐ **الخيار الأول الموصى به** |
| **Vercel** | مجاني | لا يوجد حد عملي | 100% (مطور Next.js الأصلي) | ⭐ **ممتاز للسهولة** |
| **Render** | مجاني (سيرفر ينام) / $7 | لا يوجد حد | 100% عبر Docker | 🟢 جيد |
| **Cloudflare Workers** | مجاني (حد 3MB) | ❌ **تجاوزت الحد (26MB)** | يحتاج تكييف ورفع لخطة مدفوعة ($5) | 🔴 غير موصى به حالياً |

---

## 1️⃣ الخيار الموصى به: Google Cloud Run ☁️

Google Cloud Run يعتبر الحل الأمثل لتطبيقك لأنه يعمل بنظام Containers (Docker)، مما يعطيك:
- دعم كامل وغير محدود لـ Next.js 15, Server Actions, Firebase Admin, و Genkit AI.
- **عدم وجود أي حدود على حجم الكود (تجاوزت مشكلة 3MB تماماً)**.
- **تدرج مجاني سخي جداً** (2 مليون طلب مجاناً شهرياً)، وإذا لم يزُر أحد الموقع يقل السيرفر لـ 0 مجاناً.

### الخطوات البسيطة للنشر على Google Cloud Run:

#### الطريقة الأولى: النشر بجدول أفق بأمر واحد عبر `gcloud CLI`

1. **تثبيت Google Cloud SDK**:
   قم بتنزيل وتثبيت أداة [gcloud CLI](https://cloud.google.com/sdk/docs/install) على جهازك.

2. **تسجيل الدخول واختيار المشروع**:
   ```bash
   gcloud auth login
   gcloud config set project sample-firebase-ai-app-55f54 YOUR_PROJECT_ID
   ```

3. **تنفيذ أمر النشر مباشرة من المجلد الرئيسي للتطبيق**:
   ```bash
   gcloud run deploy my-app \
     --source . \
     --region europe-west1 \
     --allow-unauthenticated \
     --set-env-vars "NEXT_PUBLIC_FIREBASE_PROJECT_ID=YOUR_PROJECT_ID,NEXT_PUBLIC_FIREBASE_API_KEY=YOUR_KEY"
   ```
   *سيقوم Google Cloud تلقائياً بقراءة الـ `Dockerfile` المرفق مع التطبيق وبنائه ونشره وتوفير رابط SSL مجاني HTTPS.*

---

#### الطريقة الثانية: النشر التلقائي عبر GitHub (CI/CD)

1. ادخل على لوحة تحكم [Google Cloud Console](https://console.cloud.google.com/).
2. ابحث عن **Cloud Run** ثم اضغط **Create Service**.
3. اختر **Continuously deploy from a repository** وربط حسابك في **GitHub**.
4. حدد الموديل/الفرع (Branch) الخاص بالتطبيق.
5. اختر **Dockerfile** للـ Build Type.
6. في قسم **Environment Variables**، أضف متغيرات البيئة من ملف `.env.example`.
7. اضغط **Create** — سيتم النشر وتحديث الموقع تلقائياً مع كل `git push`.

---

## 2️⃣ الخيار الثاني: Vercel (الأسهل والأسرع) ⚡

طالما أن التطبيق مكتوب بـ Next.js، فإن **Vercel** توفر تجربة نشر فورية بضغطة زر وبدون مشاكل أحجام:

1. انشئ حساباً على [Vercel.com](https://vercel.com).
2. اضغط على **Add New Project** وربط حساب GitHub.
3. اختر مشروع التطبيق.
4. أضف متغيرات البيئة (Environment Variables) المطلوبة.
5. اضغط **Deploy**.

---

## 3️⃣ إذا كنت ترغب في الاستمرار على Cloudflare 🔶

### سبب المشكلة:
في Cloudflare Workers المجاني، الحد الأقصى لحجم ملف الـ JavaScript المجمع هو **3 MiB**.
ملف الـ Server Handler الخاص بتطبيقك بلغ حزمه **26.3 MiB** بسبب وجود موديولات كثيرة (Firebase Admin, Genkit, Radix UI, UI components).

### الحلول المتاحة على Cloudflare:

1. **الترقية إلى الخطة المدفوعة (Workers Paid Plan)**:
   - بتكلفة $5 شهرياً، ترفع حد الحجم من 3MB إلى **10MB**، ولكن انتبه أن ملفك حالياً 26MB، لذا ستحتاج لتفعيل خاصية Dynamic Imports والتقسيم.

2. **استخدام Cloudflare Pages بدلاً من Cloudflare Workers**:
   - `open-next` يدعم التصدير لـ Cloudflare Pages حيث يتم رفع الأصول الاستاتيكية على CDN ويبقى الـ Function مقسماً.

3. **فكرة تقسيم التطبيق إلى تطبيقات فرعية (Micro-Frontends)**:
   - **هل الفكرة عملية؟**
     نعم ولكنها تضيف تعقيداً هندسياً كبيراً (حاجة لإدارة جلسات تسجيل الدخول Single Sign-On عبر عدة نطاقات فرعية، وإعادة بنية الملفات وترتيب المجلدات).
   - **التقسيم المقترح إذا أردت تطبيقه**:
     - `housing.domain.com` (السكن والعمالة)
     - `orders.domain.com` (الطلبات والصيانة)
     - `finance.domain.com` (المصروفات والإيرادات والعقود)
     - `timesheet.domain.com` (الحضور والتايم شيت)

---

## ⚙️ متغيرات البيئة المطلوبة عند النشر (Environment Variables)

تأكد من إضافة هذه المتغيرات في لوحة تحكم منصة النشر:

```env
GEMINI_API_KEY=your_gemini_key
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
BLOB_READ_WRITE_TOKEN=your_blob_token
```

---

## 📁 الملفات الجاهزة في المشروع

1. **`Dockerfile`**: تم إعداده بأسلوب Multi-stage Build مخصص لـ Next.js Standalone ليعطي أعلى أداء وأصغر حجم حاوية على Cloud Run.
2. **`next.config.ts`**: تم تفعيل `output: 'standalone'` فيه للعمل المباشر مع Cloud Run و Docker.
