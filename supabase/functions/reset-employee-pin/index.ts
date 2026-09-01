// supabase/functions/reset-employee-pin/index.ts
//
// ═══════════════════════════════════════════════════════════════════════
//  EDGE FUNCTION — ganti PIN employee (update password di auth.users)
// ═══════════════════════════════════════════════════════════════════════
// Dipanggil dari AccountView.jsx lewat
// supabase.functions.invoke('reset-employee-pin', { body: { employeeId, newPin } }).
// Sama alasannya kayak create-employee -- ganti password auth.users cuma
// bisa lewat auth.admin.updateUserById() yang butuh SERVICE_ROLE_KEY.
//
// WAJIB request dari employee yang sudah login DAN role admin (dicek dari
// JWT di header Authorization, BUKAN cuma percaya body request). Gak ada
// jalur bootstrap di sini kayak create-employee, karena reset PIN cuma
// masuk akal kalau udah ada akun admin yang mau dipakai buat reset.
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
    const { employeeId, newPin } = await req.json();

    if (!employeeId || typeof employeeId !== "string") {
      return json({ error: "employeeId wajib diisi." }, 400);
    }
    if (!newPin || typeof newPin !== "string" || !/^\d{6}$/.test(newPin)) {
      return json({ error: "PIN baru harus 6 digit angka." }, 400);
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // ── Wajib admin yang sudah login ─────────────────────────────────────
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
      return json({ error: "Cuma admin yang boleh mengubah PIN." }, 403);
    }

    // ── Pastikan target beneran ada di tabel employees ──────────────────
    const { data: targetEmployee, error: targetError } = await supabaseAdmin
      .from("employees")
      .select("id")
      .eq("id", employeeId)
      .single();
    if (targetError || !targetEmployee) return json({ error: "Akun tidak ditemukan." }, 404);

    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(employeeId, {
      password: newPin,
    });
    if (updateError) return json({ error: updateError.message || "Gagal mengubah PIN." }, 400);

    return json({ success: true });
  } catch (err) {
    console.error("reset-employee-pin error:", err);
    return json({ error: String(err) }, 500);
  }
});
