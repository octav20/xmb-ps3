async function playClick() {
    const audio = new Audio('assets/sound/down.ogg');
    await audio.play();
}

export { playClick };