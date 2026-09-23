const firebaseConfig = {
    apiKey: "AIzaSyDxpM9w1ji_Dutz_FMckvECSzex0dP7wEw",
    authDomain: "mensajes-8ee91.firebaseapp.com",
    projectId: "mensajes-8ee91",
    storageBucket: "mensajes-8ee91.firebasestorage.app",
    messagingSenderId: "904489434341",
    appId: "1:904489434341:web:daa0c4a0d07e9f8ebce80c",
    measurementId: "G-F2G6QML310"
};

// Inicialización correcta para los SDKs de Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

let currentUserData = null;
let selectedAvatarUrl = "https://api.dicebear.com/7.x/pixel-art/svg?seed=nox1";
let isRegisterMode = true;
let currentActiveChatUser = null;
let currentExternalProfileUser = null;
let currentLang = "es";
let currentPostCompressedImage = null; // Variable para la imagen comprimida del post en curso

const translations = {
    es: {
        authTitle: "Nox Direct",
        authSub: "Cifrado, minimalista y exclusivo mutuo.",
        regBtn: "Registrarse",
        logBtn: "Iniciar Sesión",
        switchReg: "¿Ya tienes cuenta? Inicia sesión",
        switchLog: "¿No tienes cuenta? Regístrate",
        feedTitle: "Feed Social (Posts)",
        searchHead: "Buscar Usuarios",
        notifHead: "Notificaciones",
        friendsHead: "Amigos Mutuos (Chat Habilitado)",
        profileTitle: "Mi Perfil",
        editProfile: "Editar Datos",
        saveProfile: "Guardar Cambios",
        settingsTitle: "Ajustes del Sistema",
        langSelect: "Idioma",
        themeSelect: "Apariencia",
        followers: "Seguidores",
        following: "Siguiendo"
    },
    en: {
        authTitle: "Nox Direct",
        authSub: "Encrypted, minimalist, mutual-exclusive.",
        regBtn: "Register",
        logBtn: "Sign In",
        switchReg: "Already have an account? Sign in",
        switchLog: "Don't have an account? Register",
        feedTitle: "Social Feed (Posts)",
        searchHead: "Search Users",
        notifHead: "Notifications",
        friendsHead: "Mutual Friends (Chat Enabled)",
        profileTitle: "My Profile",
        editProfile: "Edit Data",
        saveProfile: "Save Changes",
        settingsTitle: "System Settings",
        langSelect: "Language",
        themeSelect: "Appearance",
        followers: "Followers",
        following: "Following"
    }
};

function encryptMessage(text) {
    const secretKey = "nox_secure_salt";
    let result = "";
    for (let i = 0; i < text.length; i++) {
        result += String.fromCharCode(text.charCodeAt(i) ^ secretKey.charCodeAt(i % secretKey.length));
    }
    return btoa(encodeURIComponent(result));
}

function decryptMessage(encoded) {
    try {
        const text = decodeURIComponent(atob(encoded));
        const secretKey = "nox_secure_salt";
        let result = "";
        for (let i = 0; i < text.length; i++) {
            result += String.fromCharCode(text.charCodeAt(i) ^ secretKey.charCodeAt(i % secretKey.length));
        }
        return result;
    } catch (e) {
        return "[Mensaje cifrado incompatible]";
    }
}

document.querySelectorAll('.avatar-option').forEach(img => {
    img.addEventListener('click', (e) => {
        document.querySelectorAll('.avatar-option').forEach(el => el.classList.remove('selected'));
        e.target.classList.add('selected');
        selectedAvatarUrl = e.target.getAttribute('data-url');
    });
});

function toggleAuthMode() {
    isRegisterMode = !isRegisterMode;
    const usernameField = document.getElementById('auth-username');
    const avatarSelector = document.getElementById('avatar-selector');
    const chooseAvatarTxt = document.getElementById('txt-choose-avatar');
    
    if (usernameField) usernameField.style.display = isRegisterMode ? 'block' : 'none';
    if (avatarSelector) avatarSelector.style.display = isRegisterMode ? 'flex' : 'none';
    if (chooseAvatarTxt) chooseAvatarTxt.style.display = isRegisterMode ? 'block' : 'none';
    
    const submitAuthBtn = document.getElementById('btn-submit-auth');
    const authToggleTxt = document.getElementById('txt-auth-toggle');
    const t = translations[currentLang];

    if (submitAuthBtn) submitAuthBtn.innerHTML = `<span>${isRegisterMode ? t.regBtn : t.logBtn}</span> <i class="bi bi-arrow-right"></i>`;
    if (authToggleTxt) authToggleTxt.innerText = isRegisterMode ? t.switchReg : t.switchLog;
}

async function handleAuth() {
    const emailElem = document.getElementById('auth-email');
    const passwordElem = document.getElementById('auth-password');
    const usernameElem = document.getElementById('auth-username');

    if (!emailElem || !passwordElem) return;

    const email = emailElem.value.trim();
    const password = passwordElem.value.trim();
    const username = usernameElem ? usernameElem.value.trim() : "";

    if (!email || !password || (isRegisterMode && !username)) {
        alert("Por favor completa todos los campos requeridos.");
        return;
    }

    try {
        if (isRegisterMode) {
            const res = await auth.createUserWithEmailAndPassword(email, password);
            const user = res.user;

            await db.collection("users").doc(user.uid).set({
                uid: user.uid,
                username: username,
                email: email,
                avatar: selectedAvatarUrl,
                bio: "Hola, estoy usando Nox Direct.",
                followers: [],
                following: [],
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
        } else {
            await auth.signInWithEmailAndPassword(email, password);
        }
    } catch (error) {
        console.error("Error detallado en autenticación/Firestore:", error);
        alert("Error de autenticación: " + error.message);
    }
}

// Cierre de sesión
function logout() {
    auth.signOut().then(() => {
        currentUserData = null;
        currentActiveChatUser = null;
        currentExternalProfileUser = null;
    }).catch(error => {
        console.error("Error al cerrar sesión:", error);
    });
}

// Escuchador de estado de sesión
auth.onAuthStateChanged((user) => {
    const authScreen = document.getElementById('auth-screen');
    const appScreen = document.getElementById('app');

    if (user) {
        if (authScreen) authScreen.classList.add('hidden');
        if (appScreen) appScreen.classList.remove('hidden');
        loadUserData(user.uid);
        loadPosts();
    } else {
        if (authScreen) authScreen.classList.remove('hidden');
        if (appScreen) appScreen.classList.add('hidden');
        currentUserData = null;
    }
});

async function loadUserData(uid) {
    db.collection("users").doc(uid).onSnapshot(doc => {
        if (doc.exists) {
            currentUserData = { id: doc.id, ...doc.data() };
            renderProfile();
            loadSocialData();
            if (currentExternalProfileUser) {
                viewUserProfile(currentExternalProfileUser.uid);
            }
        }
    }, error => {
        console.error("Error al leer datos del usuario en tiempo real:", error);
    });
}

function switchSection(sectionId, btnElement) {
    document.querySelectorAll('.section-view').forEach(sec => sec.classList.remove('active'));
    document.querySelectorAll('.dock-btn').forEach(btn => btn.classList.remove('active'));
    const targetSec = document.getElementById(`sec-${sectionId}`);
    if (targetSec) targetSec.classList.add('active');
    if (btnElement) btnElement.classList.add('active');
}

async function viewUserProfile(uid) {
    if (currentUserData && currentUserData.uid === uid) {
        switchSection('profile', document.querySelectorAll('.dock-btn')[2]);
        return;
    }

    try {
        const doc = await db.collection("users").doc(uid).get();
        if (!doc.exists) {
            alert("El usuario no existe.");
            return;
        }

        currentExternalProfileUser = { id: doc.id, ...doc.data() };

        const avatarElem = document.getElementById('ext-profile-avatar');
        const usernameElem = document.getElementById('ext-profile-username');
        const bioElem = document.getElementById('ext-profile-bio');
        const statFollowers = document.getElementById('ext-stat-followers');
        const statFollowing = document.getElementById('ext-stat-following');
        const btnFollowAction = document.getElementById('btn-follow-action');

        if (avatarElem) avatarElem.src = currentExternalProfileUser.avatar || "";
        if (usernameElem) usernameElem.innerText = "@" + currentExternalProfileUser.username;
        if (bioElem) bioElem.innerText = currentExternalProfileUser.bio || "Sin biografía configurada.";
        
        if (statFollowers) statFollowers.innerText = currentExternalProfileUser.followers ? currentExternalProfileUser.followers.length : 0;
        if (statFollowing) statFollowing.innerText = currentExternalProfileUser.following ? currentExternalProfileUser.following.length : 0;

        const isFollowing = currentUserData && currentUserData.following && currentUserData.following.includes(uid);
        if (btnFollowAction) {
            btnFollowAction.innerHTML = isFollowing 
                ? '<i class="bi bi-person-check-fill"></i> Siguiendo' 
                : '<i class="bi bi-person-plus"></i> Seguir';
        }

        loadExternalUserPosts(uid);
        switchSection('user-profile');
    } catch (e) {
        console.error("Error al cargar perfil de usuario:", e);
    }
}

function goBackToFeed() {
    currentExternalProfileUser = null;
    switchSection('feed', document.querySelectorAll('.dock-btn')[0]);
}

async function toggleFollowUser() {
    if (!currentExternalProfileUser || !currentUserData) return;
    const targetUid = currentExternalProfileUser.uid;
    const isFollowing = currentUserData.following && currentUserData.following.includes(targetUid);
    
    await toggleFollow(targetUid, isFollowing);
    await viewUserProfile(targetUid);
}

async function searchUsers(query) {
    const resultsContainer = document.getElementById('search-results');
    if (!resultsContainer) return;
    resultsContainer.innerHTML = "";
    if (!query || query.length < 2) return;

    try {
        const snapshot = await db.collection("users")
            .where("username", ">=", query)
            .where("username", "<=", query + "\uf8ff")
            .limit(5)
            .get();

        snapshot.forEach(doc => {
            const u = doc.data();
            if (!currentUserData || u.uid === currentUserData.uid) return;

            const isFollowing = currentUserData.following && currentUserData.following.includes(u.uid);

            const item = document.createElement('div');
            item.className = "user-list-item";
            item.innerHTML = `
                <div class="user-info-flex" onclick="viewUserProfile('${u.uid}')" style="cursor: pointer; flex: 1;">
                    <img src="${u.avatar}" class="user-avatar" alt="Avatar">
                    <div class="user-meta">
                        <span class="uname" style="font-weight:600; font-size:13.5px;">${u.username}</span>
                        <span class="ustatus" style="display:block; font-size:11.5px; color:var(--text-secondary);">${u.bio ? u.bio.substring(0, 30) : ''}</span>
                    </div>
                </div>
                <button class="btn-secondary" style="width: auto; padding: 6px 12px;" onclick="toggleFollow('${u.uid}', ${isFollowing})">${isFollowing ? 'Siguiendo' : 'Seguir'}</button>
            `;
            resultsContainer.appendChild(item);
        });
    } catch (e) {
        console.error("Error en búsqueda:", e);
    }
}

async function toggleFollow(targetUid, isFollowing) {
    if (!currentUserData) return;
    const myUid = currentUserData.uid;
    const myRef = db.collection("users").doc(myUid);
    const targetRef = db.collection("users").doc(targetUid);

    const batch = db.batch();
    if (isFollowing) {
        batch.update(myRef, { following: firebase.firestore.FieldValue.arrayRemove(targetUid) });
        batch.update(targetRef, { followers: firebase.firestore.FieldValue.arrayRemove(myUid) });
    } else {
        batch.update(myRef, { following: firebase.firestore.FieldValue.arrayUnion(targetUid) });
        batch.update(targetRef, { followers: firebase.firestore.FieldValue.arrayUnion(myUid) });
        
        db.collection("notifications").add({
            to: targetUid,
            from: myUid,
            fromUsername: currentUserData.username,
            type: "follow",
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });
    }
    await batch.commit();

    if (isFollowing) {
        currentUserData.following = currentUserData.following.filter(id => id !== targetUid);
    } else {
        if (!currentUserData.following) currentUserData.following = [];
        currentUserData.following.push(targetUid);
    }
    
    renderProfile();
    loadSocialData();
    
    const searchInput = document.getElementById('search-input');
    if (searchInput) searchUsers(searchInput.value.trim());
}

async function loadSocialData() {
    if (!currentUserData) return;

    db.collection("notifications").where("to", "==", currentUserData.uid)
        .orderBy("timestamp", "desc").limit(10).onSnapshot(snapshot => {
            const notifList = document.getElementById('notifications-list');
            const notifDot = document.getElementById('notif-dot');
            if (!notifList) return;
            
            notifList.innerHTML = "";
            if (snapshot.empty) {
                notifList.innerHTML = "Sin actividad reciente.";
                if (notifDot) notifDot.style.display = "none";
                return;
            }
            if (notifDot) notifDot.style.display = "block";
            snapshot.forEach(doc => {
                const n = doc.data();
                const div = document.createElement('div');
                div.style.padding = "6px 0";
                div.style.borderBottom = "1px solid var(--border-color)";
                div.innerText = `@${n.fromUsername} comenzó a seguirte.`;
                notifList.appendChild(div);
            });
        });

    const mutualContainer = document.getElementById('mutual-friends-list');
    const chatThreads = document.getElementById('chat-threads');
    if (!mutualContainer || !chatThreads) return;

    mutualContainer.innerHTML = "";
    chatThreads.innerHTML = "";

    const following = currentUserData.following || [];
    const followers = currentUserData.followers || [];
    const mutuals = following.filter(uid => followers.includes(uid));

    const noChatsTxt = document.getElementById('txt-no-chats');
    if (mutuals.length === 0) {
        mutualContainer.innerHTML = "<p style='font-size:13px; color:var(--text-secondary);'>Aún no tienes amigos mutuos. Sigue a alguien que también te siga.</p>";
        if (noChatsTxt) noChatsTxt.style.display = "block";
        return;
    }

    if (noChatsTxt) noChatsTxt.style.display = "none";

    for (const mUid of mutuals) {
        const uDoc = await db.collection("users").doc(mUid).get();
        if (!uDoc.exists) continue;
        const mUser = uDoc.data();

        const mItem = document.createElement('div');
        mItem.className = "user-list-item";
        mItem.innerHTML = `
            <div class="user-info-flex" onclick="viewUserProfile('${mUser.uid}')" style="cursor: pointer; flex: 1;">
                <img src="${mUser.avatar}" class="user-avatar" alt="Avatar">
                <span class="uname" style="font-weight:600; font-size:13.5px;">${mUser.username}</span>
            </div>
            <button class="btn-secondary" style="width: auto; padding: 6px 12px;" onclick="openChat('${mUser.uid}', '${mUser.username}', '${mUser.avatar}')">Chatear</button>
        `;
        mutualContainer.appendChild(mItem);

        const threadItem = document.createElement('div');
        threadItem.className = "chat-thread-item";
        threadItem.style.cssText = "display: flex; align-items: center; gap: 12px; padding: 12px; border-bottom: 1px solid var(--border-color); cursor: pointer; transition: background 0.2s;";
        threadItem.innerHTML = `
            <img src="${mUser.avatar}" class="user-avatar" alt="Avatar">
            <span style="font-size:13px; font-weight:600;">${mUser.username}</span>
        `;
        threadItem.onclick = () => openChat(mUser.uid, mUser.username, mUser.avatar);
        chatThreads.appendChild(threadItem);
    }
}

function openChat(uid, username, avatar) {
    currentActiveChatUser = { uid, username, avatar };
    const chatHeader = document.getElementById('active-chat-header');
    if (chatHeader) {
        chatHeader.innerHTML = `<div class="user-info-flex" onclick="viewUserProfile('${uid}')" style="cursor: pointer; display: flex; align-items: center; gap: 10px;"><img src="${avatar}" class="user-avatar" alt="Avatar"><span>${username}</span></div>`;
    }
    const chatInputWrapper = document.getElementById('chat-input-wrapper');
    if (chatInputWrapper) chatInputWrapper.classList.remove('hidden');
    
    const dockBtns = document.querySelectorAll('.dock-btn');
    if (dockBtns.length > 1) {
        switchSection('chat', dockBtns[1]);
    } else {
        switchSection('chat');
    }
    loadMessages();
}

function loadMessages() {
    if (!currentActiveChatUser || !currentUserData) return;
    const chatId = [currentUserData.uid, currentActiveChatUser.uid].sort().join("_");
    
    db.collection("chats").doc(chatId).collection("messages")
        .orderBy("timestamp", "asc")
        .onSnapshot(snapshot => {
            const container = document.getElementById('chat-messages-container');
            if (!container) return;
            container.innerHTML = "";
            snapshot.forEach(doc => {
                const msg = doc.data();
                const decryptedText = decryptMessage(msg.encryptedPayload);
                const isSent = msg.sender === currentUserData.uid;

                const bubble = document.createElement('div');
                bubble.className = `message-bubble ${isSent ? 'sent' : 'received'}`;
                bubble.innerText = decryptedText;
                container.appendChild(bubble);
            });
            container.scrollTop = container.scrollHeight;
        });
}

function handleKeyPress(event) {
    if (event.key === 'Enter') {
        sendMessage();
    }
}

async function sendMessage() {
    const input = document.getElementById('message-input');
    if (!input) return;
    const text = input.value.trim();
    if (!text || !currentActiveChatUser || !currentUserData) return;

    const isMutual = currentUserData.following.includes(currentActiveChatUser.uid) && currentUserData.followers.includes(currentActiveChatUser.uid);
    if (!isMutual) {
        alert("Solo puedes enviar mensajes a usuarios con seguimiento mutuo.");
        return;
    }

    const encrypted = encryptMessage(text);
    const chatId = [currentUserData.uid, currentActiveChatUser.uid].sort().join("_");

    await db.collection("chats").doc(chatId).collection("messages").add({
        sender: currentUserData.uid,
        encryptedPayload: encrypted,
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
    });

    input.value = "";
}

function renderProfile() {
    if (!currentUserData) return;
    const avatarElem = document.getElementById('profile-view-avatar');
    const usernameElem = document.getElementById('profile-view-username');
    const bioElem = document.getElementById('profile-view-bio');
    const statFollowers = document.getElementById('stat-followers');
    const statFollowing = document.getElementById('stat-following');
    const editBio = document.getElementById('edit-bio');

    if (avatarElem) avatarElem.src = currentUserData.avatar;
    if (usernameElem) usernameElem.innerText = "@" + currentUserData.username;
    if (bioElem) bioElem.innerText = currentUserData.bio || "Sin biografía.";
    
    if (statFollowers) statFollowers.innerText = currentUserData.followers ? currentUserData.followers.length : 0;
    if (statFollowing) statFollowing.innerText = currentUserData.following ? currentUserData.following.length : 0;
    
    if (editBio) editBio.value = currentUserData.bio || "";
}

async function updateProfile() {
    if (!currentUserData) return;
    const editBioElem = document.getElementById('edit-bio');
    if (!editBioElem) return;
    const newBio = editBioElem.value.trim();
    await db.collection("users").doc(currentUserData.uid).update({ bio: newBio });
    alert("Perfil actualizado correctamente.");
}

// Subida de foto de perfil con compresión
function handleAvatarUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        const img = new Image();
        img.src = e.target.result;
        img.onload = function() {
            const canvas = document.createElement('canvas');
            const MAX_WIDTH = 120;
            const MAX_HEIGHT = 120;
            let width = img.width;
            let height = img.height;

            if (width > height) {
                if (width > MAX_WIDTH) {
                    height *= MAX_WIDTH / width;
                    width = MAX_WIDTH;
                }
            } else {
                if (height > MAX_HEIGHT) {
                    width *= MAX_HEIGHT / height;
                    height = MAX_HEIGHT;
                }
            }

            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);

            const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.6);

            currentUserData.avatar = compressedDataUrl;
            document.getElementById('profile-view-avatar').src = compressedDataUrl;

            if (currentUserData && db) {
                db.collection('users').doc(currentUserData.uid).update({
                    avatar: compressedDataUrl
                }).then(() => {
                    console.log("Avatar actualizado y comprimido exitosamente.");
                }).catch(err => console.error("Error al guardar avatar:", err));
            }
        };
    };
    reader.readAsDataURL(file);
}

// Selección y compresión de imagen para posts
function handlePostImageSelect(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        const img = new Image();
        img.src = e.target.result;
        img.onload = function() {
            const canvas = document.createElement('canvas');
            const MAX_WIDTH = 600;
            const MAX_HEIGHT = 600;
            let width = img.width;
            let height = img.height;

            if (width > height) {
                if (width > MAX_WIDTH) {
                    height *= MAX_WIDTH / width;
                    width = MAX_WIDTH;
                }
            } else {
                if (height > MAX_HEIGHT) {
                    width *= MAX_HEIGHT / height;
                    height = MAX_HEIGHT;
                }
            }

            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);

            currentPostCompressedImage = canvas.toDataURL('image/jpeg', 0.7);

            const previewContainer = document.getElementById('post-image-preview-container');
            const previewImg = document.getElementById('post-image-preview');
            if (previewContainer && previewImg) {
                previewImg.src = currentPostCompressedImage;
                previewContainer.classList.remove('hidden');
            }
        };
    };
    reader.readAsDataURL(file);
}

function removePostImage() {
    currentPostCompressedImage = null;
    const previewContainer = document.getElementById('post-image-preview-container');
    const previewImg = document.getElementById('post-image-preview');
    const fileInput = document.getElementById('post-image-input');

    if (previewContainer) previewContainer.classList.add('hidden');
    if (previewImg) previewImg.src = '';
    if (fileInput) fileInput.value = '';
}

// Contador de caracteres para posts
const postTextInput = document.getElementById('post-text-input');
if (postTextInput) {
    postTextInput.addEventListener('input', function() {
        const remaining = 300 - this.value.length;
        const counter = document.getElementById('post-char-count');
        if (counter) counter.innerText = remaining;
    });
}

// Crear publicación tipo tweet con soporte de imagen
function createPost() {
    const textInput = document.getElementById('post-text-input');
    if (!textInput) return;

    const text = textInput.value.trim();
    if (!text && !currentPostCompressedImage) {
        return alert("Escribe algo o adjunta una imagen para publicar.");
    }

    if (!currentUserData) {
        alert("Debes iniciar sesión para publicar.");
        return;
    }

    const postData = {
        uid: currentUserData.uid,
        username: currentUserData.username || "Usuario",
        avatar: currentUserData.avatar || "",
        text: text,
        image: currentPostCompressedImage || null,
        likes: [],
        reposts: [],
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    db.collection('posts').add(postData).then(() => {
        textInput.value = '';
        const charCount = document.getElementById('post-char-count');
        if (charCount) charCount.innerText = '300';
        removePostImage();
    }).catch(err => console.error("Error al crear post:", err));
}

// Cargar posts globales y filtrar reposts en perfil propio
function loadPosts() {
    db.collection('posts').orderBy('createdAt', 'desc').onSnapshot(snapshot => {
        const globalContainer = document.getElementById('global-posts-container');
        const myProfileContainer = document.getElementById('my-profile-posts-container');
        
        if (!globalContainer) return;

        globalContainer.innerHTML = '';
        if (myProfileContainer) myProfileContainer.innerHTML = '';

        if (snapshot.empty) {
            globalContainer.innerHTML = '<p style="font-size: 13px; color: var(--text-secondary); text-align: center; padding: 20px;">No hay publicaciones aún.</p>';
            if (myProfileContainer) myProfileContainer.innerHTML = '<p style="font-size: 13px; color: var(--text-secondary); text-align: center; padding: 10px;">Aún no has publicado nada.</p>';
            return;
        }

        snapshot.forEach(doc => {
            const data = doc.data();
            const postId = doc.id;

            renderPostCard(postId, data, globalContainer);

            if (currentUserData) {
                const isOwner = data.uid === currentUserData.uid;
                const isRepostedByMe = data.reposts && data.reposts.includes(currentUserData.uid);

                if ((isOwner || isRepostedByMe) && myProfileContainer) {
                    renderPostCard(postId, data, myProfileContainer, isRepostedByMe && !isOwner ? "Reposteado por ti" : null);
                }
            }
        });
    });
}

// Cargar posts de un usuario externo
function loadExternalUserPosts(targetUid) {
    db.collection('posts').where('uid', '==', targetUid).orderBy('createdAt', 'desc').onSnapshot(snapshot => {
        const extContainer = document.getElementById('ext-user-posts-container');
        if (!extContainer) return;

        extContainer.innerHTML = '';
        if (snapshot.empty) {
            extContainer.innerHTML = '<p style="font-size: 13px; color: var(--text-secondary); text-align: center; padding: 10px;">Este usuario no tiene publicaciones.</p>';
            return;
        }

        snapshot.forEach(doc => {
            renderPostCard(doc.id, doc.data(), extContainer);
        });
    });
}

// Renderizar tarjeta de post con imagen integrada
function renderPostCard(postId, data, container, badgeLabel = null) {
    const isLiked = currentUserData && data.likes && data.likes.includes(currentUserData.uid);
    const isReposted = currentUserData && data.reposts && data.reposts.includes(currentUserData.uid);
    const likesCount = data.likes ? data.likes.length : 0;
    const repostsCount = data.reposts ? data.reposts.length : 0;

    const card = document.createElement('div');
    card.className = 'tweet-card';
    card.innerHTML = `
        ${badgeLabel ? `<span style="font-size: 10px; color: var(--accent); font-weight: 600; display: block; margin-bottom: 6px;"><i class="bi bi-repeat"></i> ${badgeLabel}</span>` : ''}
        <div class="tweet-header">
            <img src="${data.avatar || 'https://api.dicebear.com/7.x/pixel-art/svg?seed=default'}" class="tweet-avatar" alt="Avatar" onclick="viewUserProfile('${data.uid}')" style="cursor: pointer;">
            <div>
                <h4 style="font-size: 14px; font-weight: 600; color: var(--text-primary); cursor: pointer;" onclick="viewUserProfile('${data.uid}')">@${data.username}</h4>
                <span style="font-size: 11px; color: var(--text-secondary);">Publicación reciente</span>
            </div>
        </div>
        <div class="tweet-body">${escapeHTML(data.text)}</div>
        
        ${data.image ? `
            <div style="margin-top: 10px; margin-bottom: 10px; border-radius: var(--radius-sm, 8px); overflow: hidden; border: 1px solid var(--border-color);">
                <img src="${data.image}" alt="Imagen del post" style="width: 100%; max-height: 350px; object-fit: cover; display: block;">
            </div>
        ` : ''}

        <div class="tweet-footer">
            <button class="tweet-action-btn ${isLiked ? 'liked' : ''}" onclick="toggleLike('${postId}')">
                <i class="bi ${isLiked ? 'bi-heart-fill' : 'bi-heart'}"></i> <span>${likesCount}</span>
            </button>
            <button class="tweet-action-btn" onclick="toggleCommentBox('${postId}')">
                <i class="bi bi-chat"></i> Comentar
            </button>
            <button class="tweet-action-btn ${isReposted ? 'reposted' : ''}" onclick="toggleRepost('${postId}')">
                <i class="bi bi-repeat"></i> <span>${repostsCount}</span>
            </button>
        </div>
        <div class="comments-section hidden" id="comments-${postId}">
            <div class="comments-list" id="comments-list-${postId}" style="margin-bottom: 8px;"></div>
            <div style="display: flex; gap: 6px;">
                <input type="text" id="comment-input-${postId}" placeholder="Escribe un comentario..." style="margin:0; padding: 8px 10px; font-size:12px;">
                <button class="btn-primary" style="width: auto; padding: 6px 12px; margin:0; font-size: 12px;" onclick="addComment('${postId}')">Comentar</button>
            </div>
        </div>
    `;
    container.appendChild(card);
    loadComments(postId);
}

function toggleLike(postId) {
    if (!currentUserData) return;
    const postRef = db.collection('posts').doc(postId);
    db.runTransaction(transaction => {
        return transaction.get(postRef).then(doc => {
            if (!doc.exists) return;
            let likes = doc.data().likes || [];
            if (likes.includes(currentUserData.uid)) {
                likes = likes.filter(uid => uid !== currentUserData.uid);
            } else {
                likes.push(currentUserData.uid);
            }
            transaction.update(postRef, { likes: likes });
        });
    }).catch(err => console.error("Error en like:", err));
}

function toggleRepost(postId) {
    if (!currentUserData) return;
    const postRef = db.collection('posts').doc(postId);
    db.runTransaction(transaction => {
        return transaction.get(postRef).then(doc => {
            if (!doc.exists) return;
            let reposts = doc.data().reposts || [];
            if (reposts.includes(currentUserData.uid)) {
                reposts = reposts.filter(uid => uid !== currentUserData.uid);
            } else {
                reposts.push(currentUserData.uid);
            }
            transaction.update(postRef, { reposts: reposts });
        });
    }).catch(err => console.error("Error en repost:", err));
}

function toggleCommentBox(postId) {
    const box = document.getElementById(`comments-${postId}`);
    if (box) box.classList.toggle('hidden');
}

function addComment(postId) {
    if (!currentUserData) return;
    const input = document.getElementById(`comment-input-${postId}`);
    const text = input.value.trim();
    if (!text) return;

    db.collection('posts').doc(postId).collection('comments').add({
        uid: currentUserData.uid,
        username: currentUserData.username || "Usuario",
        text: text,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
    }).then(() => {
        input.value = '';
    }).catch(err => console.error("Error al comentar:", err));
}

function loadComments(postId) {
    const listContainer = document.getElementById(`comments-list-${postId}`);
    if (!listContainer) return;

    db.collection('posts').doc(postId).collection('comments').orderBy('createdAt', 'asc')
        .onSnapshot(snapshot => {
            listContainer.innerHTML = '';
            if (snapshot.empty) {
                listContainer.innerHTML = '<span style="font-size: 11px; color: var(--text-secondary);">Sin comentarios aún.</span>';
                return;
            }
            snapshot.forEach(doc => {
                const cData = doc.data();
                const cItem = document.createElement('div');
                cItem.className = 'comment-item';
                cItem.innerHTML = `<strong>@${cData.username}:</strong> ${escapeHTML(cData.text)}`;
                listContainer.appendChild(cItem);
            });
        });
}

function escapeHTML(str) {
    return str.replace(/[&<>'"]/g, 
        tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
    );
}

function changeTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
}

function changeLanguage(lang) {
    currentLang = lang;
    const t = translations[lang];
    if (!t) return;
    
    const setTxt = (id, text) => {
        const el = document.getElementById(id);
        if (el) el.innerText = text;
    };

    setTxt('lbl-feed-title', t.feedTitle);
    setTxt('lbl-search-head', t.searchHead);
    setTxt('lbl-notif-head', t.notifHead);
    setTxt('lbl-friends-head', t.friendsHead);
    setTxt('lbl-profile-title', t.profileTitle);
    setTxt('lbl-edit-profile', t.editProfile);
    setTxt('btn-save-profile', t.saveProfile);
    setTxt('lbl-settings-title', t.settingsTitle);
    setTxt('lbl-lang-select', t.langSelect);
    setTxt('lbl-theme-select', t.themeSelect);
    setTxt('lbl-stat-followers', t.followers);
    setTxt('lbl-stat-following', t.following);
    
    const submitAuthBtn = document.getElementById('btn-submit-auth');
    const authToggleTxt = document.getElementById('txt-auth-toggle');
    if (submitAuthBtn) {
        submitAuthBtn.innerHTML = `<span>${isRegisterMode ? t.regBtn : t.logBtn}</span> <i class="bi bi-arrow-right"></i>`;
    }
    if (authToggleTxt) {
        authToggleTxt.innerText = isRegisterMode ? t.switchReg : t.switchLog;
    }
}