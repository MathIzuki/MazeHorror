import * as THREE from 'three';
import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls';
import { FilmPass } from 'three/examples/jsm/postprocessing/FilmPass';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass';
import { AudioListener, Audio, AudioLoader } from 'three';

// Variables globales
let camera, scene, renderer, controls, composer;
let maze = [];
const wallSize = 20;
const mazeWidth = 20; // Augmenter la taille du labyrinthe
const mazeHeight = 20;
const moveSpeed = 0.1;
const beastSpeed = 0.05;
const keys = { forward: false, backward: false, left: false, right: false };
let beast;
let bobbingTime = 0;
const bobbingSpeed = 0.1;
const bobbingAmount = 0.25;
let backgroundMusic, beastSound;

// Initialisation
init();
animate();
function init() {
    // Création de la scène
    scene = new THREE.Scene();

    // Ajout de brouillard à la scène
    scene.fog = new THREE.Fog(0x000000, 1, 16);

    // Création de la caméra
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);

    // Placer la caméra sur une position sûre
    const startX = 1; // Case initiale sûre sur l'axe X
    const startZ = 1; // Case initiale sûre sur l'axe Z
    camera.position.set(startX * wallSize + wallSize / 2, wallSize / 2, startZ * wallSize + wallSize / 2);

    // Création du renderer
    renderer = new THREE.WebGLRenderer();
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(renderer.domElement);

    // Création des contrôles
    controls = new PointerLockControls(camera, document.body);
    document.addEventListener('click', () => controls.lock());

    // Création du labyrinthe
    createMaze();

    // Création de la bête
    const beastGeometry = new THREE.BoxGeometry(wallSize / 2, wallSize / 2, wallSize / 2);
    const beastMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 });
    beast = new THREE.Mesh(beastGeometry, beastMaterial);

    // Placer la bête dans une position opposée sûre
    const beastX = mazeWidth - 2;
    const beastZ = mazeHeight - 2;
    beast.position.set(beastX * wallSize + wallSize / 2, wallSize / 2, beastZ * wallSize + wallSize / 2);
    scene.add(beast);

    // Ajout de la musique de fond
    const listener = new AudioListener();
    camera.add(listener);

    const audioLoader = new AudioLoader();
    backgroundMusic = new Audio(listener);
    audioLoader.load('sounds/background.mp3', function(buffer) {
        backgroundMusic.setBuffer(buffer);
        backgroundMusic.setLoop(true);
        backgroundMusic.setVolume(0.5);
        backgroundMusic.play();
    });

    // Ajout du son de la bête
    beastSound = new THREE.PositionalAudio(listener);
    audioLoader.load('sounds/beast.mp3', function(buffer) {
        beastSound.setBuffer(buffer);
        beastSound.setLoop(true);
        beastSound.setRefDistance(80); 
        beastSound.setMaxDistance(230); 
        beastSound.setVolume(1);
        beastSound.play();
    });
    beast.add(beastSound);

    // Écouteurs de clavier
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup', onKeyUp);

    window.addEventListener('resize', onWindowResize);

    // Post-processing setup
    composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));

    // Adjust the FilmPass parameters for a stronger old TV effect
    const filmPass = new FilmPass(0.8, 0.5, 2048, true);
    filmPass.renderToScreen = true;
    composer.addPass(filmPass);
}

function createMaze() {
    const textureLoader = new THREE.TextureLoader();

     // Charger les textures
     const wallTexture = textureLoader.load('textures/wall.jpg');
     const floorTexture = textureLoader.load('textures/floor.jpg', (texture) => {
         texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
         texture.repeat.set(mazeWidth, mazeHeight);
     });
     const ceilingTexture = textureLoader.load('textures/ceiling.jpg', (texture) => {
         texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
         texture.repeat.set(mazeWidth, mazeHeight);
     });
 

    // Créer des matériaux texturés
    const wallMaterial = new THREE.MeshBasicMaterial({ map: wallTexture });
    const floorMaterial = new THREE.MeshBasicMaterial({ map: floorTexture });
    const ceilingMaterial = new THREE.MeshBasicMaterial({ map: ceilingTexture });

    // Initialisation de la grille
    for (let x = 0; x < mazeWidth; x++) {
        maze[x] = [];
        for (let z = 0; z < mazeHeight; z++) {
            maze[x][z] = 1; // 1 représente un mur, 0 représente un chemin
        }
    }

    // Algorithme de génération de labyrinthe (division récursive simplifiée)
    function carvePassagesFrom(x, z) {
        const directions = [
            { dx: 0, dz: -2 },
            { dx: 2, dz: 0 },
            { dx: 0, dz: 2 },
            { dx: -2, dz: 0 }
        ];

        // Mélanger les directions pour un labyrinthe aléatoire
        directions.sort(() => Math.random() - 0.5);

        directions.forEach(({ dx, dz }) => {
            const nx = x + dx;
            const nz = z + dz;

            if (nx > 0 && nx < mazeWidth && nz > 0 && nz < mazeHeight && maze[nx][nz] === 1) {
                maze[x + dx / 2][z + dz / 2] = 0; // Casser le mur intermédiaire
                maze[nx][nz] = 0; // Casser le mur cible
                carvePassagesFrom(nx, nz);
            }
        });
    }

    maze[1][1] = 0; // Point de départ
    carvePassagesFrom(1, 1);

    // Créer le sol et le plafond sur toute la carte
    const floorGeometry = new THREE.PlaneGeometry(mazeWidth * wallSize, mazeHeight * wallSize);
    const floor = new THREE.Mesh(floorGeometry, floorMaterial);
    floor.rotation.x = -Math.PI / 2; // Tourner le sol pour qu'il soit horizontal
    floor.position.y = 0;
    scene.add(floor);

    const ceiling = new THREE.Mesh(floorGeometry, ceilingMaterial);
    ceiling.rotation.x = Math.PI / 2; // Tourner le plafond pour qu'il soit horizontal
    ceiling.position.y = wallSize;
    scene.add(ceiling);

    // Créer les murs dans la scène
    for (let x = 0; x < mazeWidth; x++) {
        for (let z = 0; z < mazeHeight; z++) {
            if (maze[x][z] === 1) {
                const wallGeometry = new THREE.BoxGeometry(wallSize, wallSize, wallSize);
                const wall = new THREE.Mesh(wallGeometry, wallMaterial);
                wall.position.set(x * wallSize, wallSize / 2, z * wallSize);
                scene.add(wall);
                maze[x][z] = wall; // Stocker le mur pour les collisions
            }
        }
    }
}

function onKeyDown(event) {
    switch (event.code) {
        case 'KeyW': keys.forward = true; break;
        case 'KeyS': keys.backward = true; break;
        case 'KeyD': keys.left = true; break;
        case 'KeyA': keys.right = true; break;
    }
}

function onKeyUp(event) {
    switch (event.code) {
        case 'KeyW': keys.forward = false; break;
        case 'KeyS': keys.backward = false; break;
        case 'KeyD': keys.left = false; break;
        case 'KeyA': keys.right = false; break;
    }
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    composer.setSize(window.innerWidth, window.innerHeight);
}

// Liste des marqueurs de collision
const collisionMarkers = [];

function addCollisionMarker(x, z) {
    // Function is now empty, no collision marker effects
}

function checkCollision(x, z) {
    const gridX = Math.floor(x / wallSize);
    const gridZ = Math.floor(z / wallSize);

    if (gridX < 0 || gridX >= mazeWidth || gridZ < 0 || gridZ >= mazeHeight) {
        return true; // Collision avec les limites du labyrinthe
    }

    const margin = 0.1; // Marge réduite pour une détection de collision plus précise
    const localX = x - gridX * wallSize;
    const localZ = z - gridZ * wallSize;

    if (maze[gridX] && maze[gridX][gridZ] && maze[gridX][gridZ] instanceof THREE.Mesh) {
        if (
            localX < margin ||
            localX > wallSize - margin ||
            localZ < margin ||
            localZ > wallSize - margin
        ) {
            return true;
        }
    }

    return false;
}

function animate() {
    requestAnimationFrame(animate);

    if (controls.isLocked) {
        const direction = new THREE.Vector3();
        const velocity = new THREE.Vector3();

        // Direction basée sur les touches
        direction.z = Number(keys.forward) - Number(keys.backward);
        direction.x = Number(keys.right) - Number(keys.left);
        direction.normalize();

        // Mouvement relatif à la caméra
        camera.getWorldDirection(velocity);
        velocity.y = 0; // Ignore la composante verticale
        velocity.normalize();
        velocity.multiplyScalar(moveSpeed * direction.z);

        const strafe = new THREE.Vector3();
        strafe.crossVectors(camera.up, velocity).normalize();
        strafe.multiplyScalar(moveSpeed * direction.x);

        // Calculer les nouvelles positions
        const nextX = camera.position.x + velocity.x + strafe.x;
        const nextZ = camera.position.z + velocity.z + strafe.z;

        // Vérifier les collisions avant de déplacer la caméra
        if (!checkCollision(nextX, camera.position.z)) {
            camera.position.x = nextX;
        }
        if (!checkCollision(camera.position.x, nextZ)) {
            camera.position.z = nextZ;
        }

        // Effet de balancement de la vue uniquement en mouvement
        if (direction.length() > 0) {
            bobbingTime += bobbingSpeed;
            camera.position.y = wallSize / 2 + Math.sin(bobbingTime) * bobbingAmount;
        } else {
            camera.position.y = wallSize / 2;
        }
    }

    // Déplacement de la bête vers le joueur
    const playerPosition = new THREE.Vector3();
    camera.getWorldPosition(playerPosition);

    const beastDirection = new THREE.Vector3();
    beastDirection.subVectors(playerPosition, beast.position).normalize();

    const nextBeastX = beast.position.x + beastDirection.x * beastSpeed;
    const nextBeastZ = beast.position.z + beastDirection.z * beastSpeed;

    if (!checkCollision(nextBeastX, beast.position.z)) {
        beast.position.x = nextBeastX;
    }
    if (!checkCollision(beast.position.x, nextBeastZ)) {
        beast.position.z = nextBeastZ;
    }

    // Ajuster le volume du son de la bête en fonction de la distance au joueur
    const distanceToPlayer = beast.position.distanceTo(playerPosition);
    const maxDistance = 230; // Réduire la distance maximale
    const volume = Math.max(0, 1 - distanceToPlayer / maxDistance);
    beastSound.setVolume(volume);

    // Vérifier si la bête attrape le joueur
    if (beast.position.distanceTo(playerPosition) < wallSize / 2) {
        alert('Vous avez été attrapé !');
        window.location.reload(); // Redémarrer le jeu
    }

    composer.render();
}