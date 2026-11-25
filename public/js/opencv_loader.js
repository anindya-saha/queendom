let opencv_promise;

export function load_opencv() {
    opencv_promise ??= new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = `${import.meta.env.BASE_URL}vendor/opencv.js`;
        script.async = true;

        script.onload = async () => {
            window.cv = await window.cv;
            resolve(window.cv);
        };

        script.onerror = () => {
            opencv_promise = undefined;
            script.remove();
            reject('Could not load OpenCV.');
        };

        document.head.appendChild(script);
    });

    return opencv_promise;
}
