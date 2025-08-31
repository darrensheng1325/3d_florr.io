const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const TerserPlugin = require('terser-webpack-plugin');

module.exports = {
  entry: {
    game: './src/client/game.ts',
    terrainEditor: './src/client/terrain_editor.ts'
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: 'ts-loader',
        exclude: /node_modules/,
      },
      {
        test: /\.svg$/,
        type: 'asset/resource'
      }
    ],
  },
  resolve: {
    extensions: ['.tsx', '.ts', '.js'],
  },
  output: {
    filename: '[name].bundle.js',
    path: path.resolve(__dirname, 'dist'),
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: './src/client/index.html',
      filename: 'index.html',
      chunks: ['game']
    }),
    new HtmlWebpackPlugin({
      template: './src/client/terrain_editor.html',
      filename: 'terrain_editor.html',
      chunks: ['terrainEditor']
    }),
    new CopyWebpackPlugin({
      patterns: [
        { from: 'public', to: '' }
      ]
    })
  ],
  devServer: {
    static: [
      {
        directory: path.join(__dirname, 'dist'),
      },
      {
        directory: path.join(__dirname, 'public'),
      }
    ],
    compress: true,
    port: 3000,
    proxy: [{
      context: ['/socket.io'],
      target: 'http://localhost:3000',
      ws: true
    }]
  },
  optimization: {
    minimize: false,
    splitChunks: {
      chunks: 'async',
    },
    minimizer: [
      new TerserPlugin({
        terserOptions: {
          compress: {
            drop_console: true,
          },
        },
      }),
    ]
  },
}; 