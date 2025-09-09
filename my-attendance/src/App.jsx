import { useRef, useState } from "react";
import Webcam from "react-webcam";
import { Toaster, toast } from "react-hot-toast";

export default function App() {
  const webcamRef = useRef(null);
  const [capturedImage, setCapturedImage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [studentName, setStudentName] = useState(null);

  // ✅ Convert Base64 → File properly
  const base64ToFile = (base64, filename) => {
    const arr = base64.split(',');
    const mime = arr[0].match(/:(.*?);/)[1];
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    return new File([u8arr], filename, { type: mime });
  };

  // Capture & send photo
  const capturePhoto = async () => {
    if (!webcamRef.current) return;
    setLoading(true);
    setStudentName(null);

    try {
      const imageSrc = webcamRef.current.getScreenshot();
      if (!imageSrc) {
        toast.error("No image captured. Try again!");
        setLoading(false);
        return;
      }

      const file = base64ToFile(imageSrc, "captured.jpg");
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("http://127.0.0.1:8000/recognize/", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      console.log("Response:", data);

      setCapturedImage(imageSrc);

      if (data.status === "success") {
        setStudentName(data.student);
        toast.success(`✅ Attendance marked for ${data.student}`);
      } else if (data.status === "unknown") {
        setStudentName(null);
        toast.error("❌ Face not recognized!");
      } else {
        toast.error(data.message || "Something went wrong!");
      }
    } catch (error) {
      console.error("Upload failed:", error);
      toast.error("Upload failed! Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 font-sans relative overflow-hidden">
      <Toaster position="top-center" reverseOrder={false} />

      <h1 className="text-4xl md:text-5xl font-extrabold text-white drop-shadow-lg mb-10 animate-fadeIn">
        🎥 Face Recognition Attendance System
      </h1>

      <div className="flex gap-6 bg-white/10 backdrop-blur-lg rounded-3xl shadow-2xl p-8 border border-white/20 w-[900px] animate-fadeIn">
        {/* LEFT: Webcam + Capture Button */}
        <div className="flex flex-col items-center justify-between flex-1">
          <div className="rounded-xl overflow-hidden border border-white/40 shadow-lg w-[320px] h-[240px]">
            <Webcam
              ref={webcamRef}
              screenshotFormat="image/jpeg"
              width={320}
              height={240}
              className="w-full h-full object-cover"
              videoConstraints={{ facingMode: "user", width: 640, height: 480 }}
            />
          </div>

          <button
            onClick={capturePhoto}
            disabled={loading}
            className={`mt-6 relative w-72 py-3 flex items-center justify-center gap-2 font-semibold 
              rounded-xl overflow-hidden transition duration-300 text-white shadow-lg 
              ${
                loading
                  ? "bg-gray-400 cursor-not-allowed"
                  : "bg-gradient-to-r from-green-400 to-blue-500 hover:scale-105"
              }`}
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                Processing...
              </span>
            ) : (
              <>
                <span className="text-xl">📸</span>
                <span className="relative z-10">Capture & Mark Attendance</span>
              </>
            )}
          </button>
        </div>

        {/* RIGHT: Captured Image + Student Name */}
        <div className="flex-1 flex flex-col items-center justify-center">
          {capturedImage ? (
            <div className="flex flex-col items-center space-y-3">
              <h2 className="text-white font-bold text-lg drop-shadow">
                {studentName
                  ? `✅ Attendance marked: ${studentName}`
                  : "Captured Image"}
              </h2>
              <div className="p-4 bg-white/20 backdrop-blur-md border border-white/30 rounded-2xl shadow-inner animate-fadeIn w-[320px] h-[240px] flex items-center justify-center">
                <img
                  src={capturedImage}
                  alt="captured"
                  className="w-full h-full object-cover rounded-xl border border-white/40 shadow-lg"
                />
              </div>
            </div>
          ) : (
            <div className="w-[320px] h-[240px] flex items-center justify-center rounded-xl border-2 border-dashed border-white/40 text-white/70 text-sm">
              Captured image will appear here
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
