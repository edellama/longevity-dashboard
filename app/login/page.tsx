"use client";

export default function LoginPage() {
  const handleLogin = () => {
    const clientId = process.env.NEXT_PUBLIC_WHOOP_CLIENT_ID || "";
    const redirectUri = process.env.NEXT_PUBLIC_REDIRECT_URI || "http://localhost:3000/callback";
    const scopes = "read:recovery read:sleep read:workout read:profile";
    
    // Generate a random state parameter (at least 8 characters)
    const state = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    
    // Store state in sessionStorage to verify on callback
    sessionStorage.setItem("whoop_oauth_state", state);
    
    const authUrl = `https://api.prod.whoop.com/oauth/oauth2/auth?client_id=${clientId}&response_type=code&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scopes)}&state=${state}`;
    
    window.location.href = authUrl;
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      <div className="bg-white dark:bg-gray-800 p-8 rounded-lg shadow-xl max-w-md w-full">
        <h1 className="text-3xl font-bold text-center mb-6 text-gray-900 dark:text-white">
          Longevity Dashboard
        </h1>
        <p className="text-center text-gray-600 dark:text-gray-300 mb-8">
          Connect your Whoop account to view your health metrics and trends
        </p>
        <button
          onClick={handleLogin}
          className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors duration-200"
        >
          Connect with Whoop
        </button>
      </div>
    </div>
  );
}