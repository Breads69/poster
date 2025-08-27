import React, { useState, useEffect, useRef } from 'react';
import { Upload, Settings, Moon, Sun, Image, Trash2, RotateCcw, Check, X, Copy, RefreshCw, HardDrive } from 'lucide-react';

const ImageUploadSite = () => {
  // Auth state
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  
  // UI state
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [toast, setToast] = useState(null);
  
  // Image state
  const [currentImage, setCurrentImage] = useState(null);
  const [previewImage, setPreviewImage] = useState(null);
  const [recentImages, setRecentImages] = useState([]);
  const [processingImage, setProcessingImage] = useState(null);
  
  // Settings
  const [compressionMode, setCompressionMode] = useState('preset'); // 'none', 'preset', 'manual'
  const [quality, setQuality] = useState(80);
  const [preset, setPreset] = useState('medium');
  const [githubToken, setGithubToken] = useState('');
  const [repoPath, setRepoPath] = useState('');
  const [config, setConfig] = useState({ githubToken: '', repoPath: '' });
  const [imageRefresh, setImageRefresh] = useState(Date.now());
  const [estimatedSize, setEstimatedSize] = useState(null);
  
  const fileInputRef = useRef(null);
  const canvasRef = useRef(null);

  // Load saved settings
  useEffect(() => {
    const savedAuth = localStorage.getItem('vrc-admin-auth');
    const savedTheme = localStorage.getItem('vrc-theme');
    const savedSettings = localStorage.getItem('vrc-settings');
    
    if (savedAuth === 'true') setIsLoggedIn(true);
    if (savedTheme) setIsDarkMode(savedTheme === 'dark');
    if (savedSettings) {
      const settings = JSON.parse(savedSettings);
      setCompressionMode(settings.compressionMode ?? 'preset');
      setQuality(settings.quality ?? 80);
      setPreset(settings.preset ?? 'medium');
    }
    
    // Load GitHub config from server
    if (isLoggedIn) {
      loadConfig();
      loadRecentFromServer();
    }
  }, [isLoggedIn]);
  
  // Load current image when config is loaded
  useEffect(() => {
    if (config.githubToken && config.repoPath) {
      loadCurrentImage();
    }
  }, [config, imageRefresh]);

  const loadConfig = async () => {
    try {
      const response = await fetch('/api/config');
      if (response.ok) {
        const data = await response.json();
        setConfig(data);
        setGithubToken(data.githubToken);
        setRepoPath(data.repoPath);
      }
    } catch (error) {
      console.error('Failed to load config:', error);
    }
  };

  // Load recent images from server
  const loadRecentFromServer = async () => {
    try {
      const response = await fetch('/api/recent', {
        headers: { 'Authorization': 'true' }
      });
      if (response.ok) {
        const data = await response.json();
        setRecentImages(data.images || []);
      }
    } catch (error) {
      console.error('Failed to load recent images:', error);
    }
  };

  // Save recent image to server
  const saveRecentToServer = async (imageData, size) => {
    try {
      const response = await fetch('/api/recent', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': 'true'
        },
        body: JSON.stringify({
          dataUrl: imageData,
          timestamp: new Date().toISOString(),
          size: size
        })
      });
      if (response.ok) {
        const data = await response.json();
        setRecentImages(data.images || []);
      }
    } catch (error) {
      console.error('Failed to save recent image:', error);
    }
  };

  // Save settings
  useEffect(() => {
    localStorage.setItem('vrc-theme', isDarkMode ? 'dark' : 'light');
    localStorage.setItem('vrc-settings', JSON.stringify({
      compressionMode, quality, preset
    }));
  }, [isDarkMode, compressionMode, quality, preset]);
  
  // Recalculate preview when compression settings change
  useEffect(() => {
    if (previewImage && previewImage.originalFile) {
      handleFile(previewImage.originalFile);
    }
  }, [compressionMode, quality, preset]);

  // Keyboard shortcuts & clipboard paste
  useEffect(() => {
    const handleKeyPress = (e) => {
      if (e.key === 'u' && e.ctrlKey) {
        e.preventDefault();
        fileInputRef.current?.click();
      }
      if (e.key === 'd' && e.ctrlKey) {
        e.preventDefault();
        setIsDarkMode(!isDarkMode);
      }
    };
    
    const handlePaste = (e) => {
      if (!isLoggedIn) return;
      
      const items = e.clipboardData?.items;
      if (!items) return;
      
      for (let item of items) {
        if (item.type.startsWith('image/')) {
          e.preventDefault();
          const file = item.getAsFile();
          if (file) {
            handleFile(file);
            showToast('Image pasted from clipboard');
          }
          break;
        }
      }
    };
    
    document.addEventListener('keydown', handleKeyPress);
    document.addEventListener('paste', handlePaste);
    
    return () => {
      document.removeEventListener('keydown', handleKeyPress);
      document.removeEventListener('paste', handlePaste);
    };
  }, [isDarkMode, isLoggedIn]);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const login = async () => {
    try {
      const response = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      
      if (response.ok) {
        setIsLoggedIn(true);
        localStorage.setItem('vrc-admin-auth', 'true');
        showToast('Login successful');
      } else {
        showToast('Invalid credentials', 'error');
      }
    } catch (error) {
      showToast('Login failed', 'error');
    }
  };

  const logout = () => {
    setIsLoggedIn(false);
    localStorage.removeItem('vrc-admin-auth');
    showToast('Logged out');
  };

  const loadCurrentImage = async () => {
    const token = config.githubToken || githubToken;
    const repo = config.repoPath || repoPath;
    
    if (!token || !repo) return;
    
    try {
      const response = await fetch(`https://api.github.com/repos/${repo}/contents/image1.jpg`, {
        headers: { 'Authorization': `token ${token}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        setCurrentImage({
          url: `https://raw.githubusercontent.com/${repo}/main/image1.jpg?t=${Date.now()}`,
          sha: data.sha,
          size: data.size,
          repo: repo
        });
        setProcessingImage(null);
      }
    } catch (error) {
      console.error('Failed to load current image:', error);
    }
  };

  const getCompressionQuality = () => {
    if (compressionMode === 'none') return 1.0;
    if (compressionMode === 'manual') return quality / 100;
    
    // Preset mode
    switch (preset) {
      case 'high': return 0.90;
      case 'medium': return 0.70;
      case 'low': return 0.50;
      default: return 0.70;
    }
  };

  const resizeImage = (file) => {
    return new Promise((resolve) => {
      const img = new window.Image();
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      
      const objectUrl = URL.createObjectURL(file);
      
      img.onload = () => {
        let { width, height } = img;
        const originalSize = { width, height };
        
        // Resize 4K to 2K, keep smaller sizes
        if (width > 2048 || height > 2048) {
          const ratio = Math.min(2048 / width, 2048 / height);
          width = Math.floor(width * ratio);
          height = Math.floor(height * ratio);
        }
        
        canvas.width = width;
        canvas.height = height;
        ctx.drawImage(img, 0, 0, width, height);
        
        let dataUrl;
        let outputFormat;
        
        const isJpg = file.type === 'image/jpeg' || file.type === 'image/jpg';
        const isPng = file.type === 'image/png';
        
        // Logic: JPG stays JPG, PNG always converts to JPG
        if (isJpg) {
          // JPG input: keep as JPG with appropriate quality
          const finalQuality = getCompressionQuality();
          dataUrl = canvas.toDataURL('image/jpeg', finalQuality);
          outputFormat = 'jpeg';
        } else {
          // PNG or other format: always convert to JPG
          const finalQuality = getCompressionQuality();
          dataUrl = canvas.toDataURL('image/jpeg', finalQuality);
          outputFormat = 'jpeg';
        }
        
        // Calculate actual size from data URL
        const base64Length = dataUrl.split(',')[1].length;
        const actualSize = Math.round(base64Length * 0.75);
        
        URL.revokeObjectURL(objectUrl);
        
        resolve({ 
          dataUrl, 
          originalSize, 
          newSize: { width, height },
          estimatedSize: actualSize,
          outputFormat,
          originalFormat: isJpg ? 'jpeg' : (isPng ? 'png' : 'other')
        });
      };
      
      img.src = objectUrl;
    });
  };

  const uploadToGitHub = async (imageData) => {
    const token = config.githubToken || githubToken;
    const repo = config.repoPath || repoPath;
    
    if (!token || !repo) {
      showToast('GitHub settings not configured', 'error');
      return;
    }

    const filename = 'image1.jpg';

    try {
      setProgress(25);
      
      let sha = null;
      try {
        const response = await fetch(`https://api.github.com/repos/${repo}/contents/${filename}`, {
          headers: { 'Authorization': `token ${token}` }
        });
        if (response.ok) {
          const data = await response.json();
          sha = data.sha;
        }
      } catch (e) {}
      
      setProgress(50);
      
      const base64Data = imageData.split(',')[1];
      const uploadData = {
        message: `Update ${filename} - ${new Date().toISOString()}`,
        content: base64Data,
        ...(sha && { sha })
      };
      
      setProgress(75);
      
      const response = await fetch(`https://api.github.com/repos/${repo}/contents/${filename}`, {
        method: 'PUT',
        headers: {
          'Authorization': `token ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(uploadData)
      });
      
      setProgress(100);
      
      if (response.ok) {
        showToast('Image uploaded successfully!');
        
        setProcessingImage({
          dataUrl: imageData,
          timestamp: new Date().toISOString()
        });
        
        setTimeout(() => {
          loadCurrentImage();
        }, 10000);
        
        // Save to server recent images
        const size = Math.round(base64Data.length * 0.75);
        await saveRecentToServer(imageData, size);
      } else {
        const error = await response.json();
        throw new Error(error.message || 'Upload failed');
      }
    } catch (error) {
      showToast('Upload failed: ' + error.message, 'error');
      console.error('Upload error:', error);
    }
  };

  const handleFile = async (file) => {
    if (!file || !file.type.startsWith('image/')) {
      showToast('Please select an image file', 'error');
      return;
    }
    
    if (file.size > 20 * 1024 * 1024) { // 20MB limit
      showToast('File too large (max 20MB)', 'error');
      return;
    }
    
    try {
      const result = await resizeImage(file);
      setPreviewImage({ ...result, originalFile: file });
      showToast('Image ready for upload');
    } catch (error) {
      showToast('Failed to process image: ' + error.message, 'error');
      console.error('Processing error:', error);
    }
  };

  const confirmUpload = async () => {
    if (!previewImage) return;
    
    setUploading(true);
    setProgress(0);
    
    try {
      await uploadToGitHub(previewImage.dataUrl);
    } catch (error) {
      showToast('Upload failed: ' + error.message, 'error');
    } finally {
      setUploading(false);
      setProgress(0);
      setPreviewImage(null);
      setEstimatedSize(null);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragActive(false);
    const file = e.dataTransfer.files[0];
    handleFile(file);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setDragActive(true);
  };

  const handleDragLeave = (e) => {
    if (!e.currentTarget.contains(e.relatedTarget)) {
      setDragActive(false);
    }
  };

  const reuseImage = async (imageData) => {
    setUploading(true);
    try {
      let dataUrl = imageData;
      
      // If it's a blob URL, fetch and convert to base64
      if (imageData.startsWith('http')) {
        const response = await fetch(imageData);
        const blob = await response.blob();
        dataUrl = await new Promise((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result);
          reader.readAsDataURL(blob);
        });
      }
      
      await uploadToGitHub(dataUrl);
      setProcessingImage({
        dataUrl: dataUrl,
        timestamp: new Date().toISOString()
      });
      setTimeout(() => {
        loadCurrentImage();
      }, 3000);
    } finally {
      setUploading(false);
    }
  };

  const clearRecent = async () => {
    try {
      await fetch('/api/recent', {
        method: 'DELETE',
        headers: { 'Authorization': 'true' }
      });
      setRecentImages([]);
      showToast('Recent images cleared');
    } catch (error) {
      showToast('Failed to clear recent images', 'error');
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    showToast('Copied to clipboard');
  };

  const formatFileSize = (bytes) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  if (!isLoggedIn) {
    return (
      <div className={`min-h-screen flex items-center justify-center p-4 ${isDarkMode ? 'bg-gray-900' : 'bg-gray-100'}`}>
        <div className={`max-w-md w-full p-8 rounded-2xl backdrop-blur-md ${isDarkMode ? 'bg-gray-800/80 border-gray-700' : 'bg-white/80 border-gray-200'} border shadow-2xl`}>
          <div className="text-center mb-8">
            <Image className={`w-16 h-16 mx-auto mb-4 ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`} />
            <h1 className={`text-3xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
              VRChat Image Manager
            </h1>
          </div>
          
          <div className="space-y-4">
            <input
              type="text"
              placeholder="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className={`w-full p-4 rounded-xl border ${isDarkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'} focus:ring-2 focus:ring-blue-500 focus:border-transparent`}
            />
            
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && login()}
              className={`w-full p-4 rounded-xl border ${isDarkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'} focus:ring-2 focus:ring-blue-500 focus:border-transparent`}
            />
            
            <button
              onClick={login}
              className="w-full bg-gradient-to-r from-blue-500 to-purple-600 text-white p-4 rounded-xl font-semibold hover:from-blue-600 hover:to-purple-700 transition-all duration-200 shadow-lg"
            >
              Login
            </button>
          </div>
          
          <button
            onClick={() => setIsDarkMode(!isDarkMode)}
            className={`absolute top-4 right-4 p-2 rounded-full ${isDarkMode ? 'bg-gray-700 text-yellow-400' : 'bg-gray-200 text-gray-600'}`}
          >
            {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${isDarkMode ? 'bg-gray-900' : 'bg-gray-100'} transition-colors duration-300`}>
      <canvas ref={canvasRef} className="hidden" />
      
      {/* Header */}
      <header className={`backdrop-blur-md ${isDarkMode ? 'bg-gray-800/80 border-gray-700' : 'bg-white/80 border-gray-200'} border-b sticky top-0 z-50`}>
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Image className={`w-8 h-8 ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`} />
            <h1 className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
              VRChat Image Manager
            </h1>
          </div>
          
          <div className="flex items-center space-x-4">
            <div className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
              Ctrl+U: Upload • Ctrl+V: Paste • Ctrl+D: Theme
            </div>
            
            <button
              onClick={() => setIsDarkMode(!isDarkMode)}
              className={`p-2 rounded-full ${isDarkMode ? 'bg-gray-700 text-yellow-400' : 'bg-gray-200 text-gray-600'} hover:scale-110 transition-transform`}
            >
              {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
            
            <button
              onClick={logout}
              className="bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-red-600 transition-colors"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto p-6 space-y-8">
        {/* Processing Image Notice */}
        {processingImage && (
          <div className={`p-6 rounded-2xl backdrop-blur-md ${isDarkMode ? 'bg-yellow-800/30 border-yellow-700' : 'bg-yellow-100/50 border-yellow-300'} border`}>
            <h2 className={`text-xl font-semibold mb-4 ${isDarkMode ? 'text-yellow-200' : 'text-yellow-800'}`}>
              ⏳ Processing Upload...
            </h2>
            <div className="flex flex-col md:flex-row items-start space-y-4 md:space-y-0 md:space-x-6">
              <img
                src={processingImage.dataUrl}
                alt="Processing"
                className="w-64 h-auto rounded-lg shadow-lg opacity-90"
              />
              <div className={`flex-1 ${isDarkMode ? 'text-yellow-200' : 'text-yellow-700'}`}>
                <p className="mb-2">Your image has been uploaded successfully!</p>
                <p className="text-sm">GitHub is processing the update. The image will appear below in a few seconds...</p>
                <p className="text-xs mt-2 opacity-75">Uploaded at: {new Date(processingImage.timestamp).toLocaleTimeString()}</p>
              </div>
            </div>
          </div>
        )}
        
        {/* Current Image */}
        {currentImage && (
          <div className={`p-6 rounded-2xl backdrop-blur-md ${isDarkMode ? 'bg-gray-800/50 border-gray-700' : 'bg-white/50 border-gray-200'} border`}>
            <div className="flex items-center justify-between mb-4">
              <h2 className={`text-xl font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                Current Image
              </h2>
              <button
                onClick={() => {
                  setProcessingImage(null);
                  loadCurrentImage();
                  showToast('Refreshing image...');
                }}
                className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg ${isDarkMode ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-200 text-gray-600 hover:bg-gray-300'} transition-colors`}
              >
                <RefreshCw className="w-4 h-4" />
                <span>Refresh</span>
              </button>
            </div>
            
            <div className="flex flex-col md:flex-row items-start space-y-4 md:space-y-0 md:space-x-6">
              <img
                src={currentImage.url}
                alt="Current"
                className="w-64 h-auto rounded-lg shadow-lg"
              />
              
              <div className={`flex-1 space-y-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                <div>
                  <strong>Size:</strong> {formatFileSize(currentImage.size)}
                </div>
                
                <div className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <strong>VRChat URL:</strong>
                    <button
                      onClick={() => {
                        const [username, repoName] = (currentImage.repo || repoPath || config.repoPath).split('/');
                        copyToClipboard(`https://${username}.github.io/${repoName}/image1.jpg`);
                      }}
                      className={`p-1 rounded ${isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-200'}`}
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                  </div>
                  <code className={`block p-2 rounded text-xs ${isDarkMode ? 'bg-gray-700' : 'bg-gray-100'} break-all`}>
                    {(() => {
                      const [username, repoName] = (currentImage.repo || repoPath || config.repoPath).split('/');
                      return `https://${username}.github.io/${repoName}/image1.jpg`;
                    })()}
                  </code>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Upload Area */}
        <div className={`p-6 rounded-2xl backdrop-blur-md ${isDarkMode ? 'bg-gray-800/50 border-gray-700' : 'bg-white/50 border-gray-200'} border`}>
          <h2 className={`text-xl font-semibold mb-4 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
            Upload New Image
          </h2>

          {/* Compression Settings - Compact */}
          <div className={`mb-4 p-3 rounded-lg ${isDarkMode ? 'bg-gray-700/30 border border-gray-600/50' : 'bg-gray-50 border border-gray-200'}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <span className={`text-xs font-medium ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                  COMPRESSION:
                </span>
                
                <div className="flex space-x-1">
                  <button
                    onClick={() => setCompressionMode('none')}
                    className={`px-3 py-1 text-xs rounded-md font-medium transition-all ${
                      compressionMode === 'none'
                        ? 'bg-red-500 text-white'
                        : isDarkMode
                        ? 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                        : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                    }`}
                  >
                    None
                  </button>
                  
                  <button
                    onClick={() => setCompressionMode('preset')}
                    className={`px-3 py-1 text-xs rounded-md font-medium transition-all ${
                      compressionMode === 'preset'
                        ? 'bg-blue-500 text-white'
                        : isDarkMode
                        ? 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                        : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                    }`}
                  >
                    Preset
                  </button>
                  
                  <button
                    onClick={() => setCompressionMode('manual')}
                    className={`px-3 py-1 text-xs rounded-md font-medium transition-all ${
                      compressionMode === 'manual'
                        ? 'bg-purple-500 text-white'
                        : isDarkMode
                        ? 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                        : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                    }`}
                  >
                    Manual
                  </button>
                </div>
                
                {/* Preset Options - Inline */}
                {compressionMode === 'preset' && (
                  <div className="flex space-x-1">
                    <span className="text-xs opacity-50">→</span>
                    {[
                      { name: 'high', label: 'High', percent: '90%' },
                      { name: 'medium', label: 'Med', percent: '70%' },
                      { name: 'low', label: 'Low', percent: '50%' }
                    ].map((p) => (
                      <button
                        key={p.name}
                        onClick={() => setPreset(p.name)}
                        className={`px-2 py-1 text-xs rounded transition-all ${
                          preset === p.name
                            ? 'bg-green-500 text-white'
                            : isDarkMode
                            ? 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                            : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                        }`}
                      >
                        {p.label} {p.percent}
                      </button>
                    ))}
                  </div>
                )}
                
                {/* Manual Slider - Inline */}
                {compressionMode === 'manual' && (
                  <div className="flex items-center space-x-2">
                    <span className="text-xs opacity-50">→</span>
                    <input
                      type="range"
                      min="10"
                      max="100"
                      value={quality}
                      onChange={(e) => setQuality(e.target.value)}
                      className="w-24 h-1"
                    />
                    <span className={`text-xs font-bold ${
                      quality > 80 ? 'text-green-500' : 
                      quality > 50 ? 'text-yellow-500' : 
                      'text-orange-500'
                    }`}>
                      {quality}%
                    </span>
                  </div>
                )}
              </div>
              
              {/* Live Size Preview */}
              {previewImage && (
                <div className="flex items-center space-x-2 text-xs">
                  <span className={`${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                    {formatFileSize(previewImage.originalFile.size)}
                    {previewImage.originalFormat === 'png' && ' PNG'}
                    {previewImage.originalFormat === 'jpeg' && ' JPG'}
                  </span>
                  <span className="opacity-50">→</span>
                  <span className={`font-bold ${
                    previewImage.estimatedSize < previewImage.originalFile.size 
                      ? 'text-green-500' 
                      : previewImage.estimatedSize === previewImage.originalFile.size
                      ? 'text-yellow-500'
                      : 'text-orange-500'
                  }`}>
                    {formatFileSize(previewImage.estimatedSize)}
                    {' JPG'}
                  </span>
                  {previewImage.estimatedSize < previewImage.originalFile.size && (
                    <span className="text-green-500 font-bold">
                      (-{Math.round((1 - previewImage.estimatedSize / previewImage.originalFile.size) * 100)}%)
                    </span>
                  )}
                  {previewImage.estimatedSize > previewImage.originalFile.size && (
                    <span className="text-orange-500 font-bold">
                      (+{Math.round((previewImage.estimatedSize / previewImage.originalFile.size - 1) * 100)}%)
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Drop Zone */}
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onClick={() => fileInputRef.current?.click()}
            className={`relative border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-all duration-300 ${
              dragActive
                ? 'border-blue-500 bg-blue-500/10'
                : isDarkMode
                ? 'border-gray-600 hover:border-gray-500'
                : 'border-gray-300 hover:border-gray-400'
            }`}
          >
            <Upload className={`w-16 h-16 mx-auto mb-4 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`} />
            <p className={`text-xl mb-2 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
              Drop image here, click to browse, or paste (Ctrl+V)
            </p>
            <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
              PNG, JPG supported • Auto-resize 4K→2K • Max 20MB
            </p>
            
            {uploading && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-2xl">
                <div className="text-center">
                  <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                  <p className="text-white font-semibold">Processing... {progress}%</p>
                  {progress > 0 && (
                    <div className="w-48 bg-gray-700 rounded-full h-2 mt-2">
                      <div 
                        className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${progress}%` }}
                      ></div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
          
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={(e) => handleFile(e.target.files[0])}
            className="hidden"
          />

          {previewImage && (
            <div className="mt-6">
              <h3 className={`text-lg font-semibold mb-2 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                Preview
              </h3>
              <div className="flex flex-col md:flex-row items-start space-y-4 md:space-y-0 md:space-x-6">
                <img src={previewImage.dataUrl} alt="Preview" className="w-64 h-auto rounded-lg shadow-lg" />
                
                <div className="flex-1">
                  <div className={`${isDarkMode ? 'text-gray-300' : 'text-gray-600'} text-sm space-y-1 mb-4`}>
                    <p><strong>Original:</strong> {previewImage.originalSize.width}×{previewImage.originalSize.height}</p>
                    <p><strong>Processed:</strong> {previewImage.newSize.width}×{previewImage.newSize.height}</p>
                    <p><strong>Original size:</strong> {formatFileSize(previewImage.originalFile.size)}</p>
                    <p><strong>Estimated final:</strong> ~{formatFileSize(previewImage.estimatedSize)}</p>
                  </div>
                  
                  <div className="flex space-x-3">
                    <button
                      onClick={confirmUpload}
                      disabled={uploading}
                      className="bg-green-500 text-white px-6 py-2 rounded-lg hover:bg-green-600 transition-colors disabled:opacity-50 flex items-center space-x-2"
                    >
                      <Upload className="w-4 h-4" />
                      <span>Upload</span>
                    </button>
                    
                    <button
                      onClick={() => {
                        setPreviewImage(null);
                        setEstimatedSize(null);
                      }}
                      className={`px-4 py-2 rounded-lg ${isDarkMode ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'} transition-colors`}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Recent Images (Server-synced) */}
        {recentImages.length > 0 && (
          <div className={`p-6 rounded-2xl backdrop-blur-md ${isDarkMode ? 'bg-gray-800/50 border-gray-700' : 'bg-white/50 border-gray-200'} border`}>
            <div className="flex items-center justify-between mb-4">
              <h2 className={`text-xl font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                Recent Images ({recentImages.length})
                <span className={`ml-2 text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                  <HardDrive className="w-4 h-4 inline mr-1" />
                  Server synced
                </span>
              </h2>
              
              <button
                onClick={clearRecent}
                className={`flex items-center space-x-2 px-3 py-1 rounded-lg ${isDarkMode ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-200 text-gray-600 hover:bg-gray-300'} transition-colors`}
              >
                <Trash2 className="w-4 h-4" />
                <span>Clear</span>
              </button>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              {recentImages.map((img) => (
                <div key={img.id} className={`p-3 rounded-lg border ${isDarkMode ? 'bg-gray-700/50 border-gray-600' : 'bg-white/50 border-gray-300'}`}>
                  <div className={`w-full h-24 rounded mb-2 overflow-hidden ${isDarkMode ? 'bg-gray-800' : 'bg-gray-200'}`}>
                    {img.thumbnail ? (
                      <img
                        src={img.thumbnail}
                        alt="Recent"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Image className={`w-8 h-8 ${isDarkMode ? 'text-gray-600' : 'text-gray-400'}`} />
                      </div>
                    )}
                  </div>
                  
                  <div className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-600'} mb-2 space-y-0.5`}>
                    <p>{new Date(img.timestamp).toLocaleDateString()}</p>
                    <p className="font-medium">
                      {new Date(img.timestamp).toLocaleTimeString('en-US', { 
                        hour: 'numeric', 
                        minute: '2-digit',
                        hour12: true 
                      })}
                    </p>
                    <p>{formatFileSize(img.size)}</p>
                  </div>
                  
                  {img.thumbnail && (
                    <button
                      onClick={() => reuseImage(img.thumbnail)}
                      disabled={uploading}
                      className="w-full bg-blue-500 text-white py-1 px-2 rounded text-xs hover:bg-blue-600 transition-colors disabled:opacity-50 flex items-center justify-center space-x-1"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>Reuse</span>
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Toast Notifications */}
      {toast && (
        <div className={`fixed bottom-4 right-4 p-4 rounded-lg shadow-lg z-50 flex items-center space-x-2 ${
          toast.type === 'error' 
            ? 'bg-red-500 text-white' 
            : 'bg-green-500 text-white'
        } animate-in slide-in-from-right duration-300`}>
          {toast.type === 'error' ? <X className="w-5 h-5" /> : <Check className="w-5 h-5" />}
          <span>{toast.message}</span>
        </div>
      )}
    </div>
  );
};

export default ImageUploadSite;