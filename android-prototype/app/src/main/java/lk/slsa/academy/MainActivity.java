package lk.slsa.academy;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.graphics.Bitmap;
import android.net.Uri;
import android.os.Bundle;
import android.view.View;
import android.webkit.CookieManager;
import android.webkit.SslErrorHandler;
import android.net.http.SslError;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.ProgressBar;
import android.widget.TextView;
import android.widget.Toast;

public class MainActivity extends Activity {
    private static final String HOME_URL =
            "https://prop4life.github.io/srilankascrabbleacademy/";
    private static final String EVENTS_URL = HOME_URL + "#events";
    private static final String JOIN_URL = HOME_URL + "#membership";
    private static final String PRIVACY_URL = HOME_URL + "privacy.html";
    private static final String ALLOWED_HOST = "prop4life.github.io";
    private static final String ALLOWED_PATH_PREFIX = "/srilankascrabbleacademy/";

    private WebView webView;
    private ProgressBar progress;
    private View errorPanel;
    private TextView errorMessage;

    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);
        setContentView(R.layout.activity_main);

        webView = findViewById(R.id.web_view);
        progress = findViewById(R.id.progress);
        errorPanel = findViewById(R.id.error_panel);
        errorMessage = findViewById(R.id.error_message);
        Button retry = findViewById(R.id.retry_button);
        Button home = findViewById(R.id.home_button);
        Button events = findViewById(R.id.events_button);
        Button join = findViewById(R.id.join_button);
        Button privacy = findViewById(R.id.privacy_button);
        Button share = findViewById(R.id.share_button);

        configureWebView();
        retry.setOnClickListener(v -> loadHome());
        home.setOnClickListener(v -> loadUrl(HOME_URL));
        events.setOnClickListener(v -> loadUrl(EVENTS_URL));
        join.setOnClickListener(v -> loadUrl(JOIN_URL));
        privacy.setOnClickListener(v -> loadUrl(PRIVACY_URL));
        share.setOnClickListener(v -> shareAcademy());

        if (state == null) {
            loadHome();
        } else {
            webView.restoreState(state);
        }
    }

    private void configureWebView() {
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setBuiltInZoomControls(false);
        settings.setDisplayZoomControls(false);
        settings.setMediaPlaybackRequiresUserGesture(true);

        CookieManager.getInstance().setAcceptCookie(true);
        CookieManager.getInstance().setAcceptThirdPartyCookies(webView, false);
        WebView.setWebContentsDebuggingEnabled(BuildConfig.DEBUG);

        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onProgressChanged(WebView view, int newProgress) {
                progress.setProgress(newProgress);
                progress.setVisibility(newProgress < 100 ? View.VISIBLE : View.GONE);
            }
        });

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public void onPageStarted(WebView view, String url, Bitmap favicon) {
                showWebsite();
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                return handleNavigation(request.getUrl());
            }

            @SuppressWarnings("deprecation")
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, String url) {
                return handleNavigation(Uri.parse(url));
            }

            @Override
            public void onReceivedError(
                    WebView view,
                    WebResourceRequest request,
                    WebResourceError error) {
                if (request.isForMainFrame()) {
                    showError(getString(R.string.connection_error));
                }
            }

            @Override
            public void onReceivedSslError(
                    WebView view,
                    SslErrorHandler handler,
                    SslError error) {
                handler.cancel();
                showError(getString(R.string.security_error));
            }
        });
    }

    private void loadHome() {
        loadUrl(HOME_URL);
    }

    private void loadUrl(String url) {
        showWebsite();
        webView.loadUrl(url);
    }

    private void showWebsite() {
        errorPanel.setVisibility(View.GONE);
        webView.setVisibility(View.VISIBLE);
    }

    private void showError(String message) {
        webView.setVisibility(View.GONE);
        progress.setVisibility(View.GONE);
        errorMessage.setText(message);
        errorPanel.setVisibility(View.VISIBLE);
    }

    private void openExternal(Uri uri) {
        String scheme = uri.getScheme();
        if (scheme == null || !(scheme.equalsIgnoreCase("https")
                || scheme.equalsIgnoreCase("http")
                || scheme.equalsIgnoreCase("tel")
                || scheme.equalsIgnoreCase("mailto")
                || scheme.equalsIgnoreCase("sms")
                || scheme.equalsIgnoreCase("smsto"))) {
            Toast.makeText(this, R.string.no_app_available, Toast.LENGTH_SHORT).show();
            return;
        }
        try {
            startActivity(new Intent(Intent.ACTION_VIEW, uri));
        } catch (ActivityNotFoundException exception) {
            Toast.makeText(this, R.string.no_app_available, Toast.LENGTH_SHORT).show();
        }
    }

    private boolean handleNavigation(Uri uri) {
        String path = uri.getPath();
        boolean isAcademyPage = "https".equalsIgnoreCase(uri.getScheme())
                && ALLOWED_HOST.equalsIgnoreCase(uri.getHost())
                && path != null
                && path.startsWith(ALLOWED_PATH_PREFIX);
        if (isAcademyPage) {
            return false;
        }
        openExternal(uri);
        return true;
    }

    private void shareAcademy() {
        Intent shareIntent = new Intent(Intent.ACTION_SEND);
        shareIntent.setType("text/plain");
        shareIntent.putExtra(Intent.EXTRA_SUBJECT, getString(R.string.share_subject));
        shareIntent.putExtra(Intent.EXTRA_TEXT, getString(R.string.share_text, HOME_URL));
        startActivity(Intent.createChooser(shareIntent, getString(R.string.share_chooser)));
    }

    @Override
    public void onBackPressed() {
        if (webView.canGoBack()) {
            webView.goBack();
        } else {
            super.onBackPressed();
        }
    }

    @Override
    protected void onSaveInstanceState(Bundle outState) {
        webView.saveState(outState);
        super.onSaveInstanceState(outState);
    }

    @Override
    protected void onPause() {
        webView.onPause();
        super.onPause();
    }

    @Override
    protected void onResume() {
        super.onResume();
        webView.onResume();
    }

    @Override
    protected void onDestroy() {
        webView.destroy();
        super.onDestroy();
    }
}
