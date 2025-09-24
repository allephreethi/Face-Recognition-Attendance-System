import { useRef, useState } from "react";
import Webcam from "react-webcam";
import { Toaster, toast } from "react-hot-toast";
import { Camera, CheckCircle } from "lucide-react";

export default function App() {
  const webcamRef = useRef(null);
  const [capturedImage, setCapturedImage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [studentName, setStudentName] = useState(null);
  const [timestamp, setTimestamp] = useState(null);
  const [error, setError] = useState(false);

  // Convert Base64 → File
  const base64ToFile = (base64, filename) => {
    const arr = base64.split(",");
    const mime = arr[0].match(/:(.*?);/)[1];
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) u8arr[n] = bstr.charCodeAt(n);
    return new File([u8arr], filename, { type: mime });
  };

  // Capture & send photo
  const capturePhoto = async () => {
    if (!webcamRef.current) return;
    setLoading(true);
    setStudentName(null);
    setError(false);

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
      setTimestamp(new Date().toLocaleTimeString());

      if (data.status === "success") {
        setStudentName(data.student);
        toast.success(`✅ Attendance marked for ${data.student}`);
      } else if (data.status === "unknown") {
        setError(true);
        toast.error("❌ Face not recognized!");
      } else {
        setError(true);
        toast.error(data.message || "Something went wrong!");
      }
    } catch (err) {
      console.error("Upload failed:", err);
      setError(true);
      toast.error("Upload failed! Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-[#fefefe] to-[#e8f1f5] font-sans px-6">
      <Toaster position="top-center" reverseOrder={false} />

      {/* Heading */}
      <div className="flex flex-col items-center mb-12 animate-fadeIn">
        <h1 className="text-3xl md:text-4xl font-extrabold text-gray-800 tracking-tight drop-shadow-sm">
          🎥 Face Recognition Attendance
        </h1>
        <div className="w-48 h-1 bg-gradient-to-r from-teal-400 to-sky-500 rounded-full mt-3"></div>
      </div>

      {/* Main Card */}
      <div className="flex gap-10 bg-white/90 backdrop-blur-3xl rounded-3xl shadow-2xl p-12 border border-white/40 w-full max-w-[950px] animate-fadeIn">
        {/* LEFT: Webcam + Capture */}
        <div className="flex flex-col items-center flex-1">
          <div className="relative rounded-2xl overflow-hidden border-4 border-transparent shadow-xl w-[340px] h-[260px] bg-gray-50 webcam-glow transition-all duration-500 hover:scale-105">
            <Webcam
              ref={webcamRef}
              screenshotFormat="image/jpeg"
              width={340}
              height={260}
              className="w-full h-full object-cover"
              videoConstraints={{ facingMode: "user", width: 640, height: 480 }}
            />
          </div>

          <button
            onClick={capturePhoto}
            disabled={loading}
            className={`mt-12 w-72 py-3 flex items-center justify-center gap-2 font-semibold rounded-xl text-white shadow-lg transform transition-all duration-300
              bg-gradient-to-r from-teal-400 to-sky-500 hover:scale-105 hover:shadow-2xl
              disabled:bg-gray-300 disabled:text-gray-600 disabled:cursor-not-allowed`}
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                Processing...
              </span>
            ) : (
              <>
                <Camera className="w-5 h-5" />
                <span className="relative z-10">Capture & Mark Attendance</span>
              </>
            )}
          </button>
        </div>

        {/* RIGHT: Captured Image + Info */}
        <div className="flex-1 flex flex-col items-center justify-center">
          {capturedImage ? (
            <div className="flex flex-col items-center space-y-6 animate-fadeIn">
              <div
                className={`w-[340px] h-[260px] rounded-xl overflow-hidden shadow-xl transition-all duration-300 border-4
                  border-gray-200 border-red-500 border-green-200
                  ${error ? "border-red-500 animate-pulse hover:shadow-red-400/50 hover:scale-105" : studentName ? "border-green-200 hover:shadow-green-400/50 hover:scale-105" : "border-gray-200"}`}
              >
                <img
                  src={capturedImage}
                  alt="captured"
                  className="w-full h-full object-cover transition-transform duration-300 hover:scale-[1.03]"
                />
              </div>

              <div
                className={`px-5 py-3 rounded-xl text-center shadow-md border font-medium
                  bg-gray-100 text-gray-600 border-gray-200
                  bg-red-100 text-red-600 border-red-200
                  bg-green-100 text-green-700 border-green-200
                  transition-all duration-300`}
              >
                <div className="flex flex-col items-center">
                  {studentName ? (
                    <span className="flex items-center gap-2 font-semibold text-green-700">
                      <CheckCircle className="w-5 h-5 text-green-600" />
                      Attendance marked for {studentName}
                    </span>
                  ) : error ? (
                    <span className="text-red-600 font-semibold">❌ Face not recognized</span>
                  ) : (
                    <span className="text-gray-600 font-medium">Captured Image</span>
                  )}
                  {timestamp && (
                    <span className="text-xs text-gray-500 mt-1">🕒 {timestamp}</span>
                  )}
                </div>
              </div>

              <button
                onClick={() => {
                  setCapturedImage(null);
                  setStudentName(null);
                  setError(false);
                  setTimestamp(null);
                }}
                className="mt-4 px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded-xl text-gray-700 transition-all duration-300 hover:scale-105"
              >
                Retry
              </button>
            </div>
          ) : (
            <div className="w-[340px] h-[260px] flex items-center justify-center rounded-xl border-2 border-dashed border-gray-300 text-gray-400 text-sm animate-pulse">
              Captured image will appear here
            </div>
          )}
        </div>
      </div>

      {/* Extra CSS */}
      <style>{`
        .webcam-glow {
          border-radius: 1rem;
          box-shadow: 0 0 20px rgba(56, 189, 248, 0.6), 0 0 40px rgba(45, 212, 191, 0.4);
          animation: pulseGlow 2s infinite alternate;
        }
        @keyframes pulseGlow {
          from { box-shadow: 0 0 15px rgba(56, 189, 248, 0.5), 0 0 25px rgba(45, 212, 191, 0.3); }
          to { box-shadow: 0 0 25px rgba(56, 189, 248, 0.8), 0 0 45px rgba(45, 212, 191, 0.6); }
        }
        .animate-fadeIn {
          animation: fadeIn 0.9s ease-in-out;
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
