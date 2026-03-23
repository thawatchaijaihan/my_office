const MAX_IMAGE_BYTES = 512_000;
const MAX_IMAGE_DIMENSION = 1600;

export const compressImage = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            const result = reader.result;
            if (typeof result !== "string") {
                reject(new Error("Invalid image data"));
                return;
            }

            const img = new Image();
            img.onload = () => {
                const scale = Math.min(
                    1,
                    MAX_IMAGE_DIMENSION / Math.max(img.width, img.height),
                );
                const targetWidth = Math.max(1, Math.round(img.width * scale));
                const targetHeight = Math.max(1, Math.round(img.height * scale));

                const canvas = document.createElement("canvas");
                canvas.width = targetWidth;
                canvas.height = targetHeight;
                const ctx = canvas.getContext("2d");
                if (!ctx) {
                    reject(new Error("Canvas not supported"));
                    return;
                }
                ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

                let quality = 0.88;
                const tryEncode = () => {
                    canvas.toBlob(
                        (blob) => {
                            if (!blob) {
                                reject(new Error("Compression failed"));
                                return;
                            }
                            if (blob.size <= MAX_IMAGE_BYTES || quality <= 0.5) {
                                const outReader = new FileReader();
                                outReader.onload = () => {
                                    const out = outReader.result;
                                    if (typeof out === "string") resolve(out);
                                    else reject(new Error("Invalid output data"));
                                };
                                outReader.onerror = () => reject(new Error("Read error"));
                                outReader.readAsDataURL(blob);
                                return;
                            }
                            quality -= 0.1;
                            tryEncode();
                        },
                        "image/jpeg",
                        quality,
                    );
                };

                tryEncode();
            };
            img.onerror = () => reject(new Error("Image load error"));
            img.src = result;
        };
        reader.onerror = () => reject(new Error("Read error"));
        reader.readAsDataURL(file);
    });
};
