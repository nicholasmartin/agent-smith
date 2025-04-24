const path = require('path');

module.exports = {
  entry: {
    login: './src/client/login.js',
    signup: './src/client/signup.js',
    'auth-callback': './src/client/auth-callback.js',
    dashboard: './src/client/dashboard.js'
  },
  output: {
    filename: '[name].bundle.js',
    path: path.resolve(__dirname, 'public/js/bundled'),
    clean: true
  },
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: ['@babel/preset-env']
          }
        }
      }
    ]
  },
  resolve: {
    extensions: ['.js']
  }
};
