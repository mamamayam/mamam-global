package com.admin.mamam;

import android.os.Bundle;
import androidx.core.view.WindowCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        // Edge-to-edge modern (API 30+, tetap aman di API lama karena
        // AndroidX WindowCompat sudah nge-handle fallback-nya sendiri).
        // Ini WAJIB ada supaya WebView beneran dapet WindowInsets yang
        // benar dari sistem — tanpa ini, env(safe-area-inset-top) &
        // env(safe-area-inset-bottom) di CSS bisa balik 0px meskipun
        // status bar/nav bar transparan, karena gak ada yang nyuplai
        // ukuran insets-nya ke WebView. statusBarColor/navigationBarColor
        // transparan di styles.xml cuma bikin dia transparan secara
        // visual, bukan ngasih tau CSS seberapa besar area amannya.
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
    }
}