const { createProxyMiddleware, fixRequestBody } = require('http-proxy-middleware');

module.exports = function (app) {
  app.use(
    ['/fireworks', '/crackers', '/api', '/billing/api', '/billing/fireworks', '/billing/crackers'],
    createProxyMiddleware({
      target: 'https://offer360.in',
      changeOrigin: true,
      secure: false,
      onProxyReq: (proxyReq, req, res) => {
        delete req.headers['origin'];
        delete req.headers['referer'];
        req.headers['origin'] = 'https://offer360.in';
        req.headers['referer'] = 'https://offer360.in/';
        proxyReq.setHeader('origin', 'https://offer360.in');
        proxyReq.setHeader('referer', 'https://offer360.in/');
        fixRequestBody(proxyReq, req);
      },
      pathRewrite: (path) => {
        let newPath = path.replace(/^\/billing/, '');
        if (newPath.startsWith('/api')) {
          newPath = newPath.replace(/^\/api/, '/fireworks/crackers');
        }
        return newPath;
      },
    })
  );
};
