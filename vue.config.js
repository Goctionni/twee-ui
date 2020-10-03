module.exports = {
  configureWebpack: (config) => {
    config.target = 'electron-renderer';
  },
  pwa: {
    name: 'Twee-UI'
  },

  publicPath: './'
}