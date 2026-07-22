package com.admin.mamam;

import android.os.Bundle;
import androidx.core.view.WindowCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    // Edge-to-edge modern (API WindowCompat, bukan windowTranslucentStatus
    // yang deprecated & gak reliable lagi di API 35+ / Android 15).
    // setDecorFitsSystemWindows(false) yang bikin window app digambar di
    // BELAKANG status bar & navigation bar secara proper — ini yang bikin
    // Capacitor StatusBar.setOverlaysWebView(true) beneran ngefek transparan
    // tanpa bikin ikon jam/baterai jadi belang/samar seperti percobaan lama.
    // Kontrol warna ikon (terang/gelap) tetap dipegang JS lewat
    // StatusBar.setStyle() di App.jsx setiap kali tema light/dark berubah.
    @Override
    public void onCreate(Bundle savedInstanceState) {
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
        super.onCreate(savedInstanceState);
    }
}
