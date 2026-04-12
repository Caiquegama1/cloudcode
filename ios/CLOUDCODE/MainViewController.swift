import UIKit
import WebKit

class MainViewController: UIViewController, WKNavigationDelegate, WKUIDelegate {
    private var webView: WKWebView!
    private var loadingView: UIView!
    private var statusLabel: UILabel!
    private var retryButton: UIButton!

    // URL do tunnel - atualiza automaticamente
    private var serverURL: String {
        if let saved = UserDefaults.standard.string(forKey: "cloudcode_url"), !saved.isEmpty {
            return saved
        }
        return "http://100.74.97.96:4242"
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = UIColor(red: 0.094, green: 0.094, blue: 0.18, alpha: 1)
        setupWebView()
        setupLoadingView()
        setupSettingsGesture()
        loadApp()
    }

    override var preferredStatusBarStyle: UIStatusBarStyle { .lightContent }
    override var prefersStatusBarHidden: Bool { false }

    private func setupWebView() {
        let config = WKWebViewConfiguration()
        config.allowsInlineMediaPlayback = true
        config.mediaTypesRequiringUserActionForPlayback = []

        // Allow paste
        let prefs = WKWebpagePreferences()
        prefs.allowsContentJavaScript = true
        config.defaultWebpagePreferences = prefs

        webView = WKWebView(frame: .zero, configuration: config)
        webView.navigationDelegate = self
        webView.uiDelegate = self
        webView.isOpaque = false
        webView.backgroundColor = .clear
        webView.scrollView.backgroundColor = .clear
        webView.scrollView.bounces = false
        webView.scrollView.contentInsetAdjustmentBehavior = .never
        webView.allowsBackForwardNavigationGestures = false
        webView.translatesAutoresizingMaskIntoConstraints = false

        // Custom user agent
        webView.customUserAgent = "CLOUDCODE-iOS/2.0"

        view.addSubview(webView)
        NSLayoutConstraint.activate([
            webView.topAnchor.constraint(equalTo: view.topAnchor),
            webView.bottomAnchor.constraint(equalTo: view.bottomAnchor),
            webView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            webView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
        ])
    }

    private func setupLoadingView() {
        loadingView = UIView()
        loadingView.backgroundColor = UIColor(red: 0.094, green: 0.094, blue: 0.18, alpha: 1)
        loadingView.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(loadingView)
        NSLayoutConstraint.activate([
            loadingView.topAnchor.constraint(equalTo: view.topAnchor),
            loadingView.bottomAnchor.constraint(equalTo: view.bottomAnchor),
            loadingView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            loadingView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
        ])

        let stack = UIStackView()
        stack.axis = .vertical
        stack.spacing = 16
        stack.alignment = .center
        stack.translatesAutoresizingMaskIntoConstraints = false
        loadingView.addSubview(stack)
        NSLayoutConstraint.activate([
            stack.centerXAnchor.constraint(equalTo: loadingView.centerXAnchor),
            stack.centerYAnchor.constraint(equalTo: loadingView.centerYAnchor),
        ])

        let titleLabel = UILabel()
        titleLabel.text = "CLOUDCODE"
        titleLabel.font = .systemFont(ofSize: 28, weight: .black)
        titleLabel.textColor = .white
        stack.addArrangedSubview(titleLabel)

        statusLabel = UILabel()
        statusLabel.text = "Conectando..."
        statusLabel.font = .systemFont(ofSize: 14, weight: .medium)
        statusLabel.textColor = UIColor(white: 1, alpha: 0.5)
        stack.addArrangedSubview(statusLabel)

        let spinner = UIActivityIndicatorView(style: .medium)
        spinner.color = UIColor(red: 0.486, green: 0.361, blue: 0.988, alpha: 1)
        spinner.startAnimating()
        stack.addArrangedSubview(spinner)

        retryButton = UIButton(type: .system)
        retryButton.setTitle("Tentar novamente", for: .normal)
        retryButton.titleLabel?.font = .systemFont(ofSize: 14, weight: .semibold)
        retryButton.tintColor = UIColor(red: 0.486, green: 0.361, blue: 0.988, alpha: 1)
        retryButton.isHidden = true
        retryButton.addTarget(self, action: #selector(retryTapped), for: .touchUpInside)
        stack.addArrangedSubview(retryButton)
    }

    private func setupSettingsGesture() {
        // Triple tap to change server URL
        let tripleTap = UITapGestureRecognizer(target: self, action: #selector(showSettings))
        tripleTap.numberOfTapsRequired = 3
        tripleTap.numberOfTouchesRequired = 2
        view.addGestureRecognizer(tripleTap)
    }

    @objc private func showSettings() {
        let alert = UIAlertController(
            title: "CLOUDCODE",
            message: "URL do servidor",
            preferredStyle: .alert
        )
        alert.addTextField { field in
            field.text = self.serverURL
            field.placeholder = "https://..."
            field.keyboardType = .URL
            field.autocapitalizationType = .none
            field.autocorrectionType = .no
        }
        alert.addAction(UIAlertAction(title: "Salvar", style: .default) { _ in
            if let url = alert.textFields?.first?.text, !url.isEmpty {
                UserDefaults.standard.set(url, forKey: "cloudcode_url")
                self.loadApp()
            }
        })
        alert.addAction(UIAlertAction(title: "Cancelar", style: .cancel))
        present(alert, animated: true)
    }

    private func loadApp() {
        loadingView.isHidden = false
        retryButton.isHidden = true
        statusLabel.text = "Conectando..."

        guard let url = URL(string: serverURL) else {
            statusLabel.text = "URL invalida"
            retryButton.isHidden = false
            return
        }
        webView.load(URLRequest(url: url, cachePolicy: .reloadIgnoringLocalCacheData))
    }

    @objc private func retryTapped() {
        loadApp()
    }

    // MARK: - WKNavigationDelegate

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        UIView.animate(withDuration: 0.3) {
            self.loadingView.alpha = 0
        } completion: { _ in
            self.loadingView.isHidden = true
            self.loadingView.alpha = 1
        }
    }

    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
        showError(error)
    }

    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
        showError(error)
    }

    private func showError(_ error: Error) {
        loadingView.isHidden = false
        statusLabel.text = "Mac desligado ou tunnel parado"
        retryButton.isHidden = false
    }

    // MARK: - WKUIDelegate

    func webView(
        _ webView: WKWebView,
        createWebViewWith configuration: WKWebViewConfiguration,
        for navigationAction: WKNavigationAction,
        windowFeatures: WKWindowFeatures
    ) -> WKWebView? {
        // Open links in same view
        if navigationAction.targetFrame == nil {
            webView.load(navigationAction.request)
        }
        return nil
    }

    // Microphone permission for voice input
    func webView(
        _ webView: WKWebView,
        requestMediaCapturePermissionFor origin: WKSecurityOrigin,
        initiatedByFrame frame: WKFrameInfo,
        type: WKMediaCaptureType,
        decisionHandler: @escaping (WKPermissionDecision) -> Void
    ) {
        decisionHandler(.grant)
    }
}
