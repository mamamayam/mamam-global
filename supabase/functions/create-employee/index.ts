// supabase/functions/create-employee/index.ts
//
// ═══════════════════════════════════════════════════════════════════════
//  EDGE FUNCTION — bikin akun employee baru (auth.users + tabel employees)
// ═══════════════════════════════════════════════════════════════════════
// Dipanggil dari AccountView.jsx (menu "Manajemen Akun") lewat
// supabase.functions.invoke('create-employee', { body: { name, pin, role } }).
//
// Kenapa harus lewat Edge Function (bukan insert langsung dari client):
//   - Bikin akun employee = harus bikin baris auth.users JUGA (biar bisa
//     login lewat signInWithPassword di LoginView.jsx), dan itu cuma bisa
//     lewat auth.admin.createUser() yang butuh SERVICE_ROLE_KEY. Key itu
//     TIDAK BOLEH nempel di client, makanya harus lewat sini.
//
// Alur:
//   1. Cek: ada admin AKTIF di tabel employees atau belum?
//      - BELUM ADA SAMA SEKALI (fresh install / abis migrasi) -> izinkan
//        bikin akun TANPA perlu login dulu, dan paksa role='admin' apapun
//        yang dikirim client (bootstrap admin pertama, biar gak ayam-telur:
//        gak bisa login -> gak bisa buka Manajemen Akun -> gak bisa bikin
//        akun -> gak bisa login...). Begitu ada 1 admin aktif, celah ini
//        otomatis nutup sendiri di request berikutnya.
//      - SUDAH ADA admin aktif -> WAJIB request datang dari employee yang
//        sudah login DAN role-nya admin (dicek dari JWT di header
//        Authorization, BUKAN cuma percaya body request / isAdminMode client).
//   2. Validasi input (name wajib diisi, pin harus 6 digit angka).
//   3. auth.admin.createUser() -> dapat user.id baru dari Supabase Auth.
//   4. Insert ke tabel employees pakai id YANG SAMA dari langkah 3 (App.jsx
//      nyocokin currentEmployee lewat .eq('id', session.user.id), jadi
//      employees.id HARUS sama persis dengan auth.users.id).
//   5. Kalau insert employees gagal, HAPUS LAGI auth user yang baru dibikin
//      di langkah 3 -- biar gak nyisain akun auth "hantu" tanpa pasangan
//      employees row tiap kali ada request yang gagal di tengah jalan.
//
// ENV VARS (otomatis tersedia di semua Edge Function, gak perlu di-set manual):
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { name, pin, role } = await req.json();

    if (!name || typeof name !== "string" || !name.trim()) {
      return json({ error: "Nama wajib diisi." }, 400);
    }
    if (!pin || typeof pin !== "string" || !/^\d{6}$/.test(pin)) {
      return json({ error: "PIN harus 6 digit angka." }, 400);
    }
    const requestedRole = role === "admin" ? "admin" : "staff";

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // ── Cek apakah ini bootstrap admin pertama ──────────────────────────
    const { count: adminCount, error: countError } = await supabaseAdmin
      .from("employees")
      .select("id", { count: "exact", head: true })
      .eq("role", "admin")
      .eq("is_active", true);
    if (countError) throw countError;

    const isBootstrap = (adminCount ?? 0) === 0;
    let finalRole = requestedRole;

    if (isBootstrap) {
      // Belum ada admin aktif sama sekali -> ini akun pertama, paksa admin
      // supaya gak kejebak gak bisa akses Manajemen Akun sama sekali.
      finalRole = "admin";
    } else {
      // Sudah ada admin -> request ini WAJIB datang dari admin yang sudah
      // login. Cek dari JWT di header, JANGAN percaya isAdminMode di client.
      const authHeader = req.headers.get("Authorization") ?? "";
      const jwt = authHeader.replace(/^Bearer\s+/i, "");
      if (!jwt) return json({ error: "Belum login." }, 401);

      const { data: callerData, error: callerError } = await supabaseAdmin.auth.getUser(jwt);
      if (callerError || !callerData?.user) {
        return json({ error: "Sesi tidak valid, coba login ulang." }, 401);
      }

      const { data: callerEmployee, error: callerEmpError } = await supabaseAdmin
        .from("employees")
        .select("role, is_active")
        .eq("id", callerData.user.id)
        .single();
      if (
        callerEmpError ||
        !callerEmployee ||
        !callerEmployee.is_active ||
        callerEmployee.role !== "admin"
      ) {
        return json({ error: "Cuma admin yang boleh membuat akun baru." }, 403);
      }
    }

    // ── Bikin auth user dulu ────────────────────────────────────────────
    const fakeEmail = `emp-${crypto.randomUUID()}@mamam.internal`;
    const { data: created, error: createAuthError } = await supabaseAdmin.auth.admin.createUser({
      email: fakeEmail,
      password: pin,
      email_confirm: true,
    });
    if (createAuthError || !created?.user) {
      return json({ error: createAuthError?.message || "Gagal membuat akun auth." }, 400);
    }

    // ── Baru insert ke employees, pakai id yang SAMA ────────────────────
    const { error: insertError } = await supabaseAdmin.from("employees").insert({
      id: created.user.id,
      name: name.trim(),
      role: finalRole,
      is_active: true,
    });

    if (insertError) {
      // Rollback -- jangan nyisain auth user tanpa pasangan employees row.
      await supabaseAdmin.auth.admin.deleteUser(created.user.id);
      return json({ error: insertError.message || "Gagal menyimpan data karyawan." }, 400);
    }

    return json({ success: true, id: created.user.id, bootstrap: isBootstrap });
  } catch (err) {
    console.error("create-employee error:", err);
    return json({ error: String(err) }, 500);
  }
});
