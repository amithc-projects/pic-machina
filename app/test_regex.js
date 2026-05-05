const names = ['test.jpg', 'test.mp4', 'test.webm', 'test.png', 'test.mkv'];

function check(name) {
  const ext = name.slice(name.lastIndexOf('.')).toLowerCase();
  const isImg = !!ext.match(/\.(jpg|jpeg|png|webp|gif|tif|tiff|heic|bmp)$/);
  const isVid = !!ext.match(/\.(mp4|mov|webm)$/);
  console.log(`${name} -> isImg: ${isImg}, isVid: ${isVid}`);
}

names.forEach(check);
