import '../style.css';
import * as THREE from 'three';

// 1. Scene, Camera, Renderer
const scene = new THREE.Scene();
const fog = new THREE.FogExp2(0x000000, 0.004); // サイバーパンク風の黒い霧
scene.fog = fog;

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 2000);

// ミニマップ用カメラ（俯瞰）
const minimapCamera = new THREE.OrthographicCamera(-200, 200, 200, -200, 1, 2000);
minimapCamera.position.set(0, 800, 0);
minimapCamera.lookAt(0, 0, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.autoClear = false; // 複数回レンダリングするため手動クリアに変更
document.getElementById('app')?.appendChild(renderer.domElement);

// 2. 地形と障害物
const cityGroup = new THREE.Group();
scene.add(cityGroup);

const gridHelper = new THREE.GridHelper(4000, 200, 0xff00ff, 0x0044ff);
gridHelper.position.y = 0;
cityGroup.add(gridHelper);

const buildingMaterial = new THREE.LineBasicMaterial({ color: 0x00ffff, transparent: true, opacity: 0.6 });

for (let i = 0; i < 1000; i++) {
  const width = Math.random() * 15 + 5;
  const height = Math.random() * 80 + 20;
  const depth = Math.random() * 15 + 5;

  const geo = new THREE.BoxGeometry(width, height, depth);
  const edges = new THREE.EdgesGeometry(geo);
  const building = new THREE.LineSegments(edges, buildingMaterial);

  building.position.x = (Math.random() - 0.5) * 2000;
  building.position.z = (Math.random() - 0.5) * 2000;
  building.position.y = height / 2;

  if (Math.abs(building.position.x) < 50 && building.position.z > 0 && building.position.z < 300) continue;

  cityGroup.add(building);
}

// 空中の障害物（マゼンタ色）の種類を追加
const obstacleGeometries = [
  new THREE.IcosahedronGeometry(8, 0),
  new THREE.TorusGeometry(6, 2, 8, 16),
  new THREE.OctahedronGeometry(8, 0),
  new THREE.TetrahedronGeometry(10, 0),
  new THREE.CylinderGeometry(5, 5, 15, 8)
];
const obstacleMat = new THREE.MeshBasicMaterial({ color: 0xff00ff, wireframe: true });
const obstacles: THREE.Mesh[] = [];

for (let i = 0; i < 250; i++) {
  // ランダムに形状を選択
  const randomGeo = obstacleGeometries[Math.floor(Math.random() * obstacleGeometries.length)];
  const obs = new THREE.Mesh(randomGeo, obstacleMat);
  obs.position.x = (Math.random() - 0.5) * 3000;
  obs.position.z = (Math.random() - 0.5) * 3000;
  obs.position.y = Math.random() * 300 + 40; // 空中に配置
  
  // 初期位置付近は避ける
  if (Math.abs(obs.position.x) < 100 && obs.position.z > -100 && obs.position.z < 300) continue;

  // 回転させるために配列に保存
  obstacles.push(obs);
  cityGroup.add(obs);
}

// 3. 飛行機（ファンタジー色）
const planeGroup = new THREE.Group();
scene.add(planeGroup);
planeGroup.position.y = 50;
planeGroup.position.z = 200;

// コア
const coreGeo = new THREE.OctahedronGeometry(2, 0);
const coreMat = new THREE.MeshBasicMaterial({ color: 0xff00ff, wireframe: true });
const core = new THREE.Mesh(coreGeo, coreMat);
planeGroup.add(core);

// 前進翼
const wingGeo = new THREE.ConeGeometry(1, 10, 3);
const wingMat = new THREE.MeshBasicMaterial({ color: 0x00ffff, wireframe: true });

const wingRight = new THREE.Mesh(wingGeo, wingMat);
wingRight.rotation.z = -Math.PI / 3.5;
wingRight.rotation.x = Math.PI / 2;
wingRight.position.set(4, 0, -2);
planeGroup.add(wingRight);

const wingLeft = new THREE.Mesh(wingGeo, wingMat);
wingLeft.rotation.z = Math.PI / 3.5;
wingLeft.rotation.x = Math.PI / 2;
wingLeft.position.set(-4, 0, -2);
planeGroup.add(wingLeft);

// テールエフェクト
const tailGeo = new THREE.ConeGeometry(0.5, 5, 4);
const tailMat = new THREE.MeshBasicMaterial({ color: 0xff00ff, wireframe: true });
const tail = new THREE.Mesh(tailGeo, tailMat);
tail.rotation.x = -Math.PI / 2;
tail.position.set(0, 0, 4);
planeGroup.add(tail);

// エネルギーリング
const ringGeo = new THREE.TorusGeometry(3, 0.1, 8, 24);
const ringMat = new THREE.MeshBasicMaterial({ color: 0x00ffff });
const ring1 = new THREE.Mesh(ringGeo, ringMat);
ring1.position.z = 3;
planeGroup.add(ring1);

const ring2 = new THREE.Mesh(ringGeo, ringMat);
ring2.position.z = 6;
ring2.scale.set(0.7, 0.7, 0.7);
planeGroup.add(ring2);


// 4. 入力・制御・リセット
const keys: Record<string, boolean> = {};
window.addEventListener('keydown', (e) => keys[e.code] = true);
window.addEventListener('keyup', (e) => keys[e.code] = false);

let speed = 0;
const maxSpeed = 3.0;
const acceleration = 0.05;

const rotationVelocity = new THREE.Vector3(); 

// リセットボタンの処理
document.getElementById('reset-btn')?.addEventListener('click', () => {
  planeGroup.position.set(0, 50, 200);
  planeGroup.rotation.set(0, 0, 0);
  rotationVelocity.set(0, 0, 0);
  speed = 0;
});

// カメラオフセット
const cameraOffset = new THREE.Vector3(0, 5, 20);

// 5. ゲームループ
const speedDisplay = document.getElementById('speed-display');
const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);

  // スピード制御
  if (keys['Space']) {
    speed = Math.min(speed + acceleration, maxSpeed);
  } else {
    speed = Math.max(speed - acceleration, 0);
  }

  // ピッチ (W/S) - ご要望により反転：Wで上向き(+), Sで下向き(-)
  if (keys['KeyW']) rotationVelocity.x += 0.0015;
  if (keys['KeyS']) rotationVelocity.x -= 0.0015;
  
  // ヨー (Q/E)
  if (keys['KeyQ']) rotationVelocity.y += 0.0015;
  if (keys['KeyE']) rotationVelocity.y -= 0.0015;

  // ロール (A/D)
  if (keys['KeyA']) rotationVelocity.z += 0.002;
  if (keys['KeyD']) rotationVelocity.z -= 0.002;

  // 慣性
  rotationVelocity.multiplyScalar(0.92);

  // 機体の回転
  planeGroup.rotateX(rotationVelocity.x);
  planeGroup.rotateY(rotationVelocity.y);
  planeGroup.rotateZ(rotationVelocity.z);

  // ロール自動復帰
  if (!keys['KeyA'] && !keys['KeyD']) {
      const euler = new THREE.Euler().setFromQuaternion(planeGroup.quaternion, 'ZXY');
      euler.z *= 0.98;
      planeGroup.quaternion.setFromEuler(euler);
  }

  // 機体の前進
  planeGroup.translateZ(-speed);

  // サードパーソンカメラ追従
  const idealOffset = cameraOffset.clone().applyQuaternion(planeGroup.quaternion);
  idealOffset.add(planeGroup.position);
  camera.position.lerp(idealOffset, 0.1);
  
  const idealLookAt = planeGroup.position.clone().add(
      new THREE.Vector3(0, 0, -20).applyQuaternion(planeGroup.quaternion)
  );
  const currentLookAt = new THREE.Vector3();
  camera.getWorldDirection(currentLookAt);
  currentLookAt.multiplyScalar(20).add(camera.position); 
  currentLookAt.lerp(idealLookAt, 0.1);
  camera.lookAt(currentLookAt);

  // アニメーション
  core.rotation.y += 0.05;
  core.rotation.x += 0.03;
  tail.rotation.y -= 0.2;
  ring1.rotation.z -= 0.02;
  ring2.rotation.z += 0.04;
  
  const time = clock.getElapsedTime();
  tailMat.opacity = 0.5 + 0.5 * Math.sin(time * 20);
  tailMat.transparent = true;

  // 障害物の回転アニメーション
  obstacles.forEach((obs, index) => {
    obs.rotation.x += 0.01 * (index % 3 + 1);
    obs.rotation.y += 0.02;
  });

  // 遠くに行きすぎた場合のリセット
  if (planeGroup.position.lengthSq() > 3000 * 3000) {
      planeGroup.position.set(0, 50, 200);
      camera.position.set(0, 55, 220);
  }

  // HUD
  if (speedDisplay) {
      speedDisplay.textContent = Math.floor(speed * 100).toString();
  }

  // === レンダリング ===
  
  // 1. メイン画面の描画
  renderer.setViewport(0, 0, window.innerWidth, window.innerHeight);
  renderer.setScissor(0, 0, window.innerWidth, window.innerHeight);
  renderer.setScissorTest(true);
  renderer.clear(); // 画面全体をクリア
  scene.fog = fog;  // メインカメラ用にはフォグを有効化
  renderer.render(scene, camera);

  // 2. ミニマップの描画
  const mapSize = 200;
  // viewportのyは下端からの座標
  const mapX = window.innerWidth - mapSize - 20;
  const mapY = window.innerHeight - mapSize - 20;
  
  renderer.setViewport(mapX, mapY, mapSize, mapSize);
  renderer.setScissor(mapX, mapY, mapSize, mapSize);
  renderer.setScissorTest(true);
  
  // ミニマップカメラを機体の位置に合わせる（上空から見下ろす）
  minimapCamera.position.x = planeGroup.position.x;
  minimapCamera.position.z = planeGroup.position.z;
  
  // ミニマップ描画時はフォグを無効化（上空からだと全て霧に覆われるため）
  scene.fog = null;
  // 前の描画内容を残したまま、ミニマップ部分だけクリア（深度のみ）
  renderer.clearDepth(); 
  renderer.render(scene, minimapCamera);
}

// ウィンドウリサイズ対応
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

animate();
