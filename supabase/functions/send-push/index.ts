// supabase/functions/send-push/index.ts
//
// ═══════════════════════════════════════════════════════════════════════
//  EDGE FUNCTION — terima trigger dari Postgres, kirim push via FCM
// ═══════════════════════════════════════════════════════════════════════
// Dipanggil oleh trigger `notify_new_transaction` (lihat migration SQL)
// tiap ada row baru masuk ke salesHistory / expenses.
//
// Alurnya:
//   1. Terima payload { table, record } dari Postgres trigger
//   2. Format jadi teks notif yang enak dibaca
//   3. Ambil semua device_tokens yang terdaftar
//   4. Kirim ke tiap token via FCM HTTP v1 API (pakai OAuth2 service account)
//
// ENV VARS yang harus di-set di Supabase Dashboard → Edge Functions → Secrets:
//   FCM_PROJECT_ID           -> Project ID Firebase (dari Firebase Console)
//   FCM_SERVICE_ACCOUNT_JSON -> isi file JSON service account (stringified)
//   SUPABASE_URL             -> otomatis tersedia
//   SUPABASE_SERVICE_ROLE_KEY-> otomatis tersedia (dipakai baca device_tokens, bypass RLS)

import { createClient } from "npm:@supabase/supabase-js@2";

// ── Helper: format pesan notif dari record transaksi ─────────────────────
function formatNotification(table: string, record: Record<string, any>) {
  if (table === "salesHistory") {
    const total = Number(record.total || 0).toLocaleString("id-ID");
    const method = record.paymentMethod || "Tunai";
    return {
      title: "🛒 Transaksi Baru",
      body: `Rp${total} • ${method}${record.orderType ? " • " + record.orderType : ""}`,
    };
  }
  if (table === "expenses") {
    const amount = Number(record.amount || 0).toLocaleString("id-ID");
    return {
      title: "💸 Pengeluaran Baru",
      body: `Rp${amount}${record.category ? " • " + record.category : ""}${record.description ? " — " + record.description : ""}`,
    };
  }
  // fallback generik kalau nanti nambah tabel lain
  return { title: `Update: ${table}`, body: "Ada data baru masuk." };
}

// ── Helper: bikin OAuth2 access token dari service account (buat FCM v1) ─
// FCM HTTP v1 butuh OAuth2 token, bukan server key lama (legacy API sudah
// dimatikan Google Juni 2024), jadi kita generate JWT lalu tukar ke access token.
async function getAccessToken(serviceAccount: any): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const claim = {
    iss: serviceAccount.client_email,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud: "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now,
  };

  const enc = (obj: any) =>
    btoa(JSON.stringify(obj)).replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");

  const unsigned = `${enc(header)}.${enc(claim)}`;

  const keyData = serviceAccount.private_key
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\s/g, "");
  const binaryKey = Uint8Array.from(atob(keyData), (c) => c.charCodeAt(0));

  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    binaryKey,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    cryptoKey,
    new TextEncoder().encode(unsigned)
  );

  const encodedSig = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/=+$/, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");

  const jwt = `${unsigned}.${encodedSig}`;

  const resp = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });

  const data = await resp.json();
  if (!resp.ok) throw new Error(`OAuth token gagal: ${JSON.stringify(data)}`);
  return data.access_token;
}

Deno.serve(async (req) => {
  try {
    const payload = await req.json();
    const { table, record } = payload;

    if (!table || !record) {
      return new Response(JSON.stringify({ error: "payload tidak lengkap" }), { status: 400 });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: tokens, error } = await supabase
      .from("device_tokens")
      .select("fcm_token");

    if (error) throw error;
    if (!tokens || tokens.length === 0) {
      return new Response(JSON.stringify({ skipped: "belum ada device_tokens terdaftar" }), { status: 200 });
    }

    const serviceAccount = JSON.parse(Deno.env.get("FCM_SERVICE_ACCOUNT_JSON")!);
    const projectId = Deno.env.get("FCM_PROJECT_ID")!;
    const accessToken = await getAccessToken(serviceAccount);

    const { title, body } = formatNotification(table, record);

    const results = await Promise.allSettled(
      tokens.map((t) =>
        fetch(`https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            message: {
              token: t.fcm_token,
              notification: { title, body },
              android: { priority: "high" },
            },
          }),
        })
      )
    );

    const failed = results.filter((r) => r.status === "rejected").length;

    return new Response(
      JSON.stringify({ sent: tokens.length - failed, failed }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("send-push error:", err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
});
