/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['docx', 'pdfkit', 'fontkit', 'restructure', 'jpeg-exif', 'iconv-lite'],
  },
};

module.exports = nextConfig;
