import * as THREE from 'three';
import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls.js';
import { FilmPass } from 'three/examples/jsm/postprocessing/FilmPass.js';
import { GlitchPass } from 'three/examples/jsm/postprocessing/GlitchPass.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { AudioListener, Audio, AudioLoader } from 'three';

// ----------------------------------------------------------------
// Paramètres labyrinthe & taille
// ----------------------------------------------------------------
const wallSize = 20;
const mazeWidth = 20;
const mazeHeight = 20;

// ----------------------------------------------------------------
// Variables globales
// ----------------------------------------------------------------
let camera, scene, renderer, controls, composer;
let maze = []; // 2D [x][z] : 0=chemin, 1=mur
const keys = { forward: false, backward: false, left: false, right: false };

// Mur & collisions
const wallBoxes = [];

// Joueur
const moveSpeed = 0.5;
let bobbingTime = 0;
const bobbingSpeed = 0.4;
const bobbingAmount = 0.2;

// Bête
let beast;
const beastSpeed = 0.3;
let beastSound;

// Gestion "sortie du mur"
let beastCollisionsActive = false;

// IA BFS
let beastPath = null;

// Audio
let backgroundMusic;

// --- Gestion du glitch "léger" et aléatoire ---
let glitchPass;
let glitchIsActive = false;
let glitchTimer = 0;
let glitchDuration = 0.8; // le glitch dure 0.8s
let nextGlitchDelay = 0;

// Mesure du temps
let clock = new THREE.Clock();

// Pour savoir si le jeu est démarré
let gameStarted = false;

// ----------------------------------------------------------------
// Écran d'intro / lore
// ----------------------------------------------------------------
showIntroScreen();

// ----------------------------------------------------------------
// showIntroScreen()
// Crée un overlay HTML "creepy" + lore + bouton "Commencer"
// ----------------------------------------------------------------
function showIntroScreen() {
    // Création d’un <div> qui recouvre tout l’écran
    const overlay = document.createElement('div');
    overlay.style.position = 'fixed';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.width = '100%';
    overlay.style.height = '100%';
    overlay.style.background = 'black';
    overlay.style.color = 'white';
    overlay.style.fontFamily = 'Arial, sans-serif';
    overlay.style.display = 'flex';
    overlay.style.flexDirection = 'column';
    overlay.style.alignItems = 'center';
    overlay.style.justifyContent = 'center';
    overlay.style.textAlign = 'center';
    overlay.style.zIndex = '9999';

    // 1) Styles d’animations creepy
    // ----------------------------------------------------------------
    // - "flicker" : clignotement global
    // - "glitch" : duplication & décalage du texte
    // (Ici, on les insère via <style>, en JS pour la démo.)
    const styleSheet = document.createElement('style');
    styleSheet.textContent = `
    @keyframes flickerBackground {
      0%, 100% { opacity: 1; }
      10%, 50%, 90% { opacity: 0.5; }
      20%, 70% { opacity: 0.8; }
    }

    @keyframes glitchTitle {
      0% {
        clip: rect(18px, 9999px, 68px, 0);
        transform: skew(0.56deg);
      }
      10% {
        clip: rect(80px, 9999px, 15px, 0);
        transform: skew(0.12deg);
      }
      20% {
        clip: rect(39px, 9999px, 50px, 0);
        transform: skew(0.2deg);
      }
      30% {
        clip: rect(65px, 9999px, 36px, 0);
        transform: skew(0.3deg);
      }
      40% {
        clip: rect(10px, 9999px, 34px, 0);
        transform: skew(0.8deg);
      }
      50% {
        clip: rect(45px, 9999px, 60px, 0);
        transform: skew(0.1deg);
      }
      60% {
        clip: rect(60px, 9999px, 80px, 0);
        transform: skew(0.3deg);
      }
      70% {
        clip: rect(30px, 9999px, 55px, 0);
        transform: skew(0.5deg);
      }
      80% {
        clip: rect(20px, 9999px, 70px, 0);
        transform: skew(0.2deg);
      }
      90% {
        clip: rect(55px, 9999px, 80px, 0);
        transform: skew(0.9deg);
      }
      100% {
        clip: rect(10px, 9999px, 60px, 0);
        transform: skew(0.1deg);
      }
    }

    .flickerMe {
      animation: flickerBackground 3s infinite;
    }

    .glitch {
      position: relative;
      display: inline-block;
      animation: glitchTitle 2s infinite ease-in-out alternate-reverse;
    }

    .glitch::before,
    .glitch::after {
      content: attr(data-text);
      position: absolute;
      left: 0;
    }

    .glitch::before {
      text-shadow: 2px 0 red;
      top: -2px;
      color: white;
      overflow: hidden;
      clip: rect(0, 900px, 0, 0);
    }

    .glitch::after {
      text-shadow: -2px 0 lime;
      top: 2px;
      color: white;
      overflow: hidden;
      clip: rect(0, 900px, 0, 0);
    }
    `;
    document.head.appendChild(styleSheet);

    // 2) On applique l’animation flicker au overlay
    // ----------------------------------------------------------------
    overlay.classList.add('flickerMe');

    // 3) Contenu "glitch" sur le titre
    // ----------------------------------------------------------------
    // On crée un <h1> avec la classe "glitch"
    const glitchTitle = document.createElement('h1');
    glitchTitle.className = 'glitch';
    glitchTitle.setAttribute('data-text', 'Le Labyrinthe des Pierres Oubliées');
    glitchTitle.textContent = 'Le Labyrinthe des Pierres Oubliées';
    overlay.appendChild(glitchTitle);

    // 4) Ajout d’un paragraphe creepy
    // ----------------------------------------------------------------
    const loreText = document.createElement('div');
    loreText.style.maxWidth = '800px';
    loreText.style.margin = '20px';
    loreText.innerHTML = `
        <p>
            Vous vous réveillez, désorienté, au milieu de blocs de pierre et d'une brume épaisse.  
            Une voix enfantine, chargée d'échos distordus, vous appelle :  
            <em>« Viens jouer avec moi... »</em>  
        </p>
        <p>
            On dit qu'une petite fille perdue erre ici depuis des siècles,  
            son âme brisée rodant dans ce labyrinthe sombre.  
            Son rire macabre se répercute d'un mur à l'autre.  
            Ses chants, parfois proches, parfois lointains, vous glacent le sang.  
        </p>
        <p>
            Trouverez-vous la sortie avant qu'elle ne vous trouve,  
            ou sombrerez-vous dans la folie de ces couloirs sans fin ?
        </p>
    `;
    overlay.appendChild(loreText);

    // 5) Bouton pour commencer
    // ----------------------------------------------------------------
    const startBtn = document.createElement('button');
    startBtn.textContent = 'Commencer';
    startBtn.style.padding = '10px 20px';
    startBtn.style.fontSize = '18px';
    startBtn.style.cursor = 'pointer';
    overlay.appendChild(startBtn);

    document.body.appendChild(overlay);

    // 6) Événements au clic / au clavier
    // ----------------------------------------------------------------
    startBtn.addEventListener('click', () => {
        startGame();
        document.body.removeChild(overlay);
        openEyesEffect();
    });

    document.addEventListener('keydown', function onAnyKey() {
        if (!gameStarted) {
            startGame();
            document.body.removeChild(overlay);
            openEyesEffect();
            document.removeEventListener('keydown', onAnyKey);
        }
    });
}
// ----------------------------------------------------------------
// openEyesEffect()
// Simule un effet "on ouvre les yeux" en fade out
// ----------------------------------------------------------------
function openEyesEffect() {
    // Overlay noir par-dessus, qu'on va faire disparaitre
    const eyesOverlay = document.createElement('div');
    eyesOverlay.style.position = 'fixed';
    eyesOverlay.style.top = '0';
    eyesOverlay.style.left = '0';
    eyesOverlay.style.width = '100%';
    eyesOverlay.style.height = '100%';
    eyesOverlay.style.background = 'black';
    eyesOverlay.style.zIndex = '9998';
    eyesOverlay.style.opacity = '1';
    eyesOverlay.style.transition = 'opacity 1.5s ease';

    document.body.appendChild(eyesOverlay);

    // On déclenche le fade out après un petit délai
    setTimeout(() => {
        eyesOverlay.style.opacity = '0';
    }, 100);

    // On retire l’overlay une fois la transition terminée
    eyesOverlay.addEventListener('transitionend', () => {
        document.body.removeChild(eyesOverlay);
    }, { once: true });
}

// ----------------------------------------------------------------
// startGame()
// Lance l'initialisation + l'animation
// ----------------------------------------------------------------
function startGame() {
    if (gameStarted) return;
    gameStarted = true;
    init();
    animate();
}

// ----------------------------------------------------------------
// init()
// ----------------------------------------------------------------
function init() {
    scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0x000000, 1, 23);

    camera = new THREE.PerspectiveCamera(
        75,
        window.innerWidth / window.innerHeight,
        0.1,
        1000
    );

    // Position de départ
    camera.position.set(
        1 * wallSize + wallSize / 2,
        wallSize / 2,
        1 * wallSize + wallSize / 2
    );

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(renderer.domElement);

    // Contrôles
    controls = new PointerLockControls(camera, document.body);

    // Génération du labyrinthe
    createMaze();

    // Bête
    const beastGeometry = new THREE.BoxGeometry(wallSize / 2, wallSize / 2, wallSize / 2);
    const beastMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 });
    beast = new THREE.Mesh(beastGeometry, beastMaterial);

    const beastX = mazeWidth - 2;
    const beastZ = mazeHeight - 2;
    maze[beastX][beastZ] = 0;
    beast.position.set(
        beastX * wallSize + wallSize / 2,
        wallSize / 2,
        beastZ * wallSize + wallSize / 2
    );
    scene.add(beast);

    if (!beastIsStuck()) {
        beastCollisionsActive = true;
    }

    // Audio
    const listener = new AudioListener();
    camera.add(listener);

    const audioLoader = new AudioLoader();

    backgroundMusic = new THREE.Audio(listener);
    audioLoader.load('sounds/background.mp3', (buffer) => {
        backgroundMusic.setBuffer(buffer);
        backgroundMusic.setLoop(true);
        backgroundMusic.setVolume(0.5);
        backgroundMusic.play();
    });

    beastSound = new THREE.PositionalAudio(listener);
    audioLoader.load('sounds/beast.mp3', (buffer) => {
        beastSound.setBuffer(buffer);
        beastSound.setLoop(true);
        beastSound.setRefDistance(80);
        beastSound.setMaxDistance(230);
        beastSound.setVolume(1);
        beastSound.play();
    });
    beast.add(beastSound);

    // Écouteurs clavier
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup', onKeyUp);

    // Pointer lock
    document.addEventListener('click', () => controls.lock());

    // Resize
    window.addEventListener('resize', onWindowResize);

    // Post-processing
    composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));

    const filmPass = new FilmPass(0.8, 0.5, 512, false);
    composer.addPass(filmPass);

    glitchPass = new GlitchPass();
    glitchPass.goWild = false;
    glitchPass.enabled = false;
    composer.addPass(glitchPass);

    scheduleNextGlitch();

    createCrosshair();
}

// ----------------------------------------------------------------
// createCrosshair()
// ----------------------------------------------------------------
function createCrosshair() {
    const crosshair = document.createElement('div');
    crosshair.style.position = 'fixed';
    crosshair.style.top = '50%';
    crosshair.style.left = '50%';
    crosshair.style.width = '11px';
    crosshair.style.height = '11px';
    crosshair.style.marginLeft = '-10px';
    crosshair.style.marginTop = '-10px';
    crosshair.style.borderRadius = '50%';
    crosshair.style.border = '2px solid rgba(255, 255, 255, 0.56)';
    crosshair.style.pointerEvents = 'none';
    document.body.appendChild(crosshair);
}

// ----------------------------------------------------------------
// createMaze()
// ----------------------------------------------------------------
function createMaze() {
    for (let x = 0; x < mazeWidth; x++) {
        maze[x] = [];
        for (let z = 0; z < mazeHeight; z++) {
            maze[x][z] = 1;
        }
    }

    maze[1][1] = 0;
    carvePassagesFrom(1, 1);

    const textureLoader = new THREE.TextureLoader();
    const wallTexture = textureLoader.load('textures/wall1.webp');
    const floorTexture = textureLoader.load('textures/floor1.webp', (texture) => {
        texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
        texture.repeat.set(mazeWidth, mazeHeight);
    });
    const ceilingTexture = textureLoader.load('textures/ceiling.webp', (texture) => {
        texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
        texture.repeat.set(mazeWidth, mazeHeight);
    });

    const wallMaterial = new THREE.MeshBasicMaterial({ map: wallTexture });
    const floorMaterial = new THREE.MeshBasicMaterial({ map: floorTexture });
    const ceilingMaterial = new THREE.MeshBasicMaterial({ map: ceilingTexture });

    const floorGeometry = new THREE.PlaneGeometry(mazeWidth * wallSize, mazeHeight * wallSize);
    const floor = new THREE.Mesh(floorGeometry, floorMaterial);
    floor.rotation.x = -Math.PI / 2;
    floor.position.set((mazeWidth * wallSize) / 2, 0, (mazeHeight * wallSize) / 2);
    scene.add(floor);

    const ceiling = new THREE.Mesh(floorGeometry, ceilingMaterial);
    ceiling.rotation.x = Math.PI / 2;
    ceiling.position.set((mazeWidth * wallSize) / 2, wallSize, (mazeHeight * wallSize) / 2);
    scene.add(ceiling);

    // Murs
    for (let x = 0; x < mazeWidth; x++) {
        for (let z = 0; z < mazeHeight; z++) {
            if (maze[x][z] === 1) {
                const wallGeom = new THREE.BoxGeometry(wallSize, wallSize, wallSize);
                const wall = new THREE.Mesh(wallGeom, wallMaterial);
                wall.position.set(
                    x * wallSize + wallSize / 2,
                    wallSize / 2,
                    z * wallSize + wallSize / 2
                );
                scene.add(wall);

                wall.updateMatrixWorld(true);
                const box = new THREE.Box3().setFromObject(wall);
                wallBoxes.push(box);
            }
        }
    }
}

// ----------------------------------------------------------------
// carvePassagesFrom
// ----------------------------------------------------------------
function carvePassagesFrom(x, z) {
    const directions = [
        { dx: 0, dz: -2 },
        { dx: 2, dz: 0 },
        { dx: 0, dz: 2 },
        { dx: -2, dz: 0 }
    ];
    shuffle(directions);

    directions.forEach(({ dx, dz }) => {
        const nx = x + dx;
        const nz = z + dz;
        if (
            nx > 0 && nx < mazeWidth &&
            nz > 0 && nz < mazeHeight &&
            maze[nx][nz] === 1
        ) {
            maze[x + dx / 2][z + dz / 2] = 0;
            maze[nx][nz] = 0;
            carvePassagesFrom(nx, nz);
        }
    });
}

// ----------------------------------------------------------------
// shuffle
// ----------------------------------------------------------------
function shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

// ----------------------------------------------------------------
// beastIsStuck
// ----------------------------------------------------------------
function beastIsStuck() {
    const halfSize = wallSize / 4;
    const beastBox = new THREE.Box3(
        new THREE.Vector3(beast.position.x - halfSize, 0, beast.position.z - halfSize),
        new THREE.Vector3(beast.position.x + halfSize, wallSize / 2, beast.position.z + halfSize)
    );
    for (let i = 0; i < wallBoxes.length; i++) {
        if (beastBox.intersectsBox(wallBoxes[i])) {
            return true;
        }
    }
    return false;
}

// ----------------------------------------------------------------
// onKeyDown / onKeyUp
// ----------------------------------------------------------------
function onKeyDown(e) {
    switch (e.code) {
        case 'KeyW': keys.forward = true; break;
        case 'KeyS': keys.backward = true; break;
        case 'KeyA': keys.left = true; break;
        case 'KeyD': keys.right = true; break;
    }
}
function onKeyUp(e) {
    switch (e.code) {
        case 'KeyW': keys.forward = false; break;
        case 'KeyS': keys.backward = false; break;
        case 'KeyA': keys.left = false; break;
        case 'KeyD': keys.right = false; break;
    }
}

// ----------------------------------------------------------------
// onWindowResize
// ----------------------------------------------------------------
function onWindowResize() {
    if (!gameStarted) return;
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    composer.setSize(window.innerWidth, window.innerHeight);
}

// ----------------------------------------------------------------
// canMove(newX, newZ, objectHeight)
// ----------------------------------------------------------------
function canMove(newX, newZ, objectHeight) {
    if (
        newX < 0 ||
        newZ < 0 ||
        newX > mazeWidth * wallSize ||
        newZ > mazeHeight * wallSize
    ) {
        return false;
    }

    const halfSize = 2;
    const testBox = new THREE.Box3(
        new THREE.Vector3(newX - halfSize, 0, newZ - halfSize),
        new THREE.Vector3(newX + halfSize, objectHeight, newZ + halfSize)
    );
    for (let i = 0; i < wallBoxes.length; i++) {
        if (testBox.intersectsBox(wallBoxes[i])) {
            return false;
        }
    }
    return true;
}

// ----------------------------------------------------------------
// animate
// ----------------------------------------------------------------
function animate() {
    requestAnimationFrame(animate);
    if (!gameStarted) return;

    const dt = clock.getDelta();

    movePlayer(dt);
    moveBeast();
    updateGlitch(dt);

    composer.render();
}

// ----------------------------------------------------------------
// updateGlitch(dt)
// ----------------------------------------------------------------
function updateGlitch(dt) {
    glitchTimer += dt;
    if (!glitchIsActive) {
        if (glitchTimer >= nextGlitchDelay) {
            glitchPass.enabled = true;
            glitchIsActive = true;
            glitchTimer = 0;
        }
    } else {
        if (glitchTimer >= glitchDuration) {
            glitchPass.enabled = false;
            glitchIsActive = false;
            glitchTimer = 0;
            scheduleNextGlitch();
        }
    }
}

// ----------------------------------------------------------------
// scheduleNextGlitch()
// ----------------------------------------------------------------
function scheduleNextGlitch() {
    nextGlitchDelay = 5 + Math.random() * 15; // 5..20
}

// ----------------------------------------------------------------
// movePlayer(dt)
// ----------------------------------------------------------------
function movePlayer(dt) {
    if (!controls.isLocked) return;

    const forward = keys.forward ? 1 : 0;
    const backward = keys.backward ? 1 : 0;
    const left = keys.left ? 1 : 0;
    const right = keys.right ? 1 : 0;

    const directionZ = forward - backward;
    // Remarque: inversé pour correspondre à la logique gauche/droite
    const directionX = left - right; // si KeyA => +1, KeyD => -1

    const forwardVec = new THREE.Vector3();
    camera.getWorldDirection(forwardVec);
    forwardVec.y = 0;
    forwardVec.normalize();

    const rightVec = new THREE.Vector3();
    rightVec.crossVectors(camera.up, forwardVec).normalize();

    const velocity = new THREE.Vector3();
    velocity.addScaledVector(forwardVec, directionZ);
    velocity.addScaledVector(rightVec, directionX);
    if (velocity.length() > 1) {
        velocity.normalize();
    }
    velocity.multiplyScalar(moveSpeed);

    const nextX = camera.position.x + velocity.x;
    const nextZ = camera.position.z + velocity.z;

    if (canMove(nextX, camera.position.z, wallSize)) {
        camera.position.x = nextX;
    }
    if (canMove(camera.position.x, nextZ, wallSize)) {
        camera.position.z = nextZ;
    }

    // Balancement
    if (velocity.length() > 0.001) {
        bobbingTime += bobbingSpeed * dt * 60;
        camera.position.y = wallSize / 2 + Math.sin(bobbingTime) * bobbingAmount;
    } else {
        camera.position.y = wallSize / 2;
    }
}

// ----------------------------------------------------------------
// moveBeast
// ----------------------------------------------------------------
function moveBeast() {
    if (!beastCollisionsActive) {
        if (!beastIsStuck()) {
            beastCollisionsActive = true;
        }
    }

    const beastCell = getGridCell(beast.position);
    const playerCell = getGridCell(camera.position);
    beastPath = findPath(beastCell, playerCell);

    if (!beastPath || beastPath.length < 2) {
        basicMoveTowardPlayer();
        return;
    }

    const nextTarget = beastPath[1];
    const targetX = nextTarget.x * wallSize + wallSize / 2;
    const targetZ = nextTarget.z * wallSize + wallSize / 2;

    const dir = new THREE.Vector3(targetX - beast.position.x, 0, targetZ - beast.position.z);
    const dist = dir.length();
    if (dist < 0.1) {
        return;
    }
    dir.normalize();
    const step = beastSpeed;

    const nextBeastX = beast.position.x + dir.x * step;
    const nextBeastZ = beast.position.z + dir.z * step;

    if (beastCollisionsActive) {
        if (canMove(nextBeastX, beast.position.z, wallSize / 2)) {
            beast.position.x = nextBeastX;
        }
        if (canMove(beast.position.x, nextBeastZ, wallSize / 2)) {
            beast.position.z = nextBeastZ;
        }
    } else {
        beast.position.x = nextBeastX;
        beast.position.z = nextBeastZ;
    }

    const distanceToPlayer = beast.position.distanceTo(camera.position);
    const maxDistance = 230;
    const volume = Math.max(0, 1 - distanceToPlayer / maxDistance);
    beastSound.setVolume(volume);

    if (distanceToPlayer < wallSize / 2) {
        alert('Vous avez été attrapé !');
        window.location.reload();
    }
}

// ----------------------------------------------------------------
// basicMoveTowardPlayer
// ----------------------------------------------------------------
function basicMoveTowardPlayer() {
    const playerPos = new THREE.Vector3();
    camera.getWorldPosition(playerPos);

    const beastDirection = new THREE.Vector3();
    beastDirection.subVectors(playerPos, beast.position).normalize();

    const nextBeastX = beast.position.x + beastDirection.x * beastSpeed;
    const nextBeastZ = beast.position.z + beastDirection.z * beastSpeed;

    if (beastCollisionsActive) {
        if (canMove(nextBeastX, beast.position.z, wallSize / 2)) {
            beast.position.x = nextBeastX;
        }
        if (canMove(beast.position.x, nextBeastZ, wallSize / 2)) {
            beast.position.z = nextBeastZ;
        }
    } else {
        beast.position.x = nextBeastX;
        beast.position.z = nextBeastZ;
    }
}

// ----------------------------------------------------------------
// getGridCell
// ----------------------------------------------------------------
function getGridCell(pos) {
    return {
        x: Math.floor(pos.x / wallSize),
        z: Math.floor(pos.z / wallSize)
    };
}

// ----------------------------------------------------------------
// findPath (BFS)
// ----------------------------------------------------------------
function findPath(start, end) {
    if (start.x === end.x && start.z === end.z) {
        return [start];
    }
    const visited = Array.from({ length: mazeWidth }, () => Array(mazeHeight).fill(false));
    const queue = [];
    const parent = {};

    queue.push(start);
    visited[start.x][start.z] = true;
    parent[`${start.x},${start.z}`] = null;

    const dirs = [
        { dx: 1, dz: 0 },
        { dx: -1, dz: 0 },
        { dx: 0, dz: 1 },
        { dx: 0, dz: -1 },
    ];

    while (queue.length > 0) {
        const current = queue.shift();
        if (current.x === end.x && current.z === end.z) {
            return reconstructPath(parent, current);
        }
        for (let { dx, dz } of dirs) {
            const nx = current.x + dx;
            const nz = current.z + dz;
            if (nx >= 0 && nx < mazeWidth && nz >= 0 && nz < mazeHeight) {
                if (!visited[nx][nz] && maze[nx][nz] === 0) {
                    visited[nx][nz] = true;
                    parent[`${nx},${nz}`] = current;
                    queue.push({ x: nx, z: nz });
                }
            }
        }
    }
    return null;
}

// ----------------------------------------------------------------
// reconstructPath
// ----------------------------------------------------------------
function reconstructPath(parent, endCell) {
    const path = [];
    let curr = endCell;
    while (curr) {
        path.push(curr);
        curr = parent[`${curr.x},${curr.z}`];
    }
    path.reverse();
    return path;
}
