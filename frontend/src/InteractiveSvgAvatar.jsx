import React, { useEffect, useRef, useState } from "react";

export default function InteractiveSvgAvatar({
  maxOffsetPx = 3,
  svgWidth = 277,
  svgHeight = 300,
  className = "",
  style = { width: 160, height: 160, marginTop: 24, marginBottom: 12 },
  keepEyesClosed = false, // New prop to control if eyes should stay closed
}) {
  const containerRef = useRef(null);
  const svgRef = useRef(null);
  const leftPupilRef = useRef(null);
  const rightPupilRef = useRef(null);
  const leftEyeGroupRef = useRef(null);
  const rightEyeGroupRef = useRef(null);
  const rafRef = useRef(null);
  
  const [eyesClosed, setEyesClosed] = useState(true);

  useEffect(() => {
    const container = containerRef.current;
    const svgEl = svgRef.current;
    const leftPupil = leftPupilRef.current;
    const rightPupil = rightPupilRef.current;
    if (!container || !svgEl || !leftPupil || !rightPupil) return;

    // Initial centers from SVG attributes (these are in SVG user units)
    const leftCx = 106.5;
    const leftCy = 141.588;
    const rightCx = 172.5;
    const rightCy = 141.588;

    let rect = container.getBoundingClientRect();
    function updateRect() {
      rect = container.getBoundingClientRect();
    }
    window.addEventListener("resize", updateRect);

    // Target and current offsets in SVG units
    const target = { lx: 0, ly: 0, rx: 0, ry: 0 };
    const current = { lx: 0, ly: 0, rx: 0, ry: 0 };

    // Helper: convert a screen offset (px) to SVG user units for current scale
    function screenPxToSvgUnits(px) {
      const scale = svgWidth / rect.width;
      return px * scale;
    }

    function handlePointerMove(clientX, clientY) {
      // If keepEyesClosed prop is true, don't open eyes
      if (keepEyesClosed) {
        setEyesClosed(true);
        target.lx = target.ly = target.rx = target.ry = 0;
        return;
      }

      // Open eyes when cursor moves (not in sidebar)
      if (clientX >= 270) {
        setEyesClosed(false);
      } else {
        setEyesClosed(true);
        target.lx = target.ly = target.rx = target.ry = 0;
        return;
      }

      // Eye centers in screen coordinates
      const leftScreenX = rect.left + (leftCx / svgWidth) * rect.width;
      const leftScreenY = rect.top + (leftCy / svgHeight) * rect.height;
      const rightScreenX = rect.left + (rightCx / svgWidth) * rect.width;
      const rightScreenY = rect.top + (rightCy / svgHeight) * rect.height;

      // Direction vectors for left eye (screen px)
      const dirLX = clientX - leftScreenX;
      const dirLY = clientY - leftScreenY;
      const lenL = Math.hypot(dirLX, dirLY) || 1;
      const nxL = dirLX / lenL;
      const nyL = dirLY / lenL;

      // Direction vectors for right eye (screen px)
      const dirRX = clientX - rightScreenX;
      const dirRY = clientY - rightScreenY;
      const lenR = Math.hypot(dirRX, dirRY) || 1;
      const nxR = dirRX / lenR;
      const nyR = dirRY / lenR;

      // Desired move in screen px (cap by maxOffsetPx) - reduced movement
      const moveLxPx = nxL * Math.min(maxOffsetPx, lenL * 0.08);  // Reduced from 0.08 to 0.05
      const moveLyPx = nyL * Math.min(maxOffsetPx, lenL * 0.08);
      const moveRxPx = nxR * Math.min(maxOffsetPx, lenR * 0.08);
      const moveRyPx = nyR * Math.min(maxOffsetPx, lenR * 0.08);

      // Convert to SVG units for transform translation
      target.lx = screenPxToSvgUnits(moveLxPx);
      target.ly = screenPxToSvgUnits(moveLyPx);
      target.rx = screenPxToSvgUnits(moveRxPx);
      target.ry = screenPxToSvgUnits(moveRyPx);
    }

    function onMouseMove(e) {
      handlePointerMove(e.clientX, e.clientY);
    }
    
    function onTouchMove(e) {
      if (e.touches && e.touches[0]) {
        handlePointerMove(e.touches[0].clientX, e.touches[0].clientY);
      }
    }
    
    function onLeave() {
      target.lx = target.ly = target.rx = target.ry = 0;
      setEyesClosed(true);
    }

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("touchmove", onTouchMove, { passive: true });
    
    container.addEventListener("mouseleave", onLeave);
    container.addEventListener("touchend", onLeave);

    // Animation loop
    function animate() {
      // Lerp toward target for smooth animation
      const ease = 0.18;
      current.lx += (target.lx - current.lx) * ease;
      current.ly += (target.ly - current.ly) * ease;
      current.rx += (target.rx - current.rx) * ease;
      current.ry += (target.ry - current.ry) * ease;

      // Apply transform attribute to each pupil
      leftPupil.setAttribute("transform", `translate(${current.lx.toFixed(3)} ${current.ly.toFixed(3)})`);
      rightPupil.setAttribute("transform", `translate(${current.rx.toFixed(3)} ${current.ry.toFixed(3)})`);

      rafRef.current = requestAnimationFrame(animate);
    }

    rafRef.current = requestAnimationFrame(animate);

    return () => {
      window.removeEventListener("resize", updateRect);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("touchmove", onTouchMove);
      container.removeEventListener("mouseleave", onLeave);
      container.removeEventListener("touchend", onLeave);
      cancelAnimationFrame(rafRef.current);
    };
  }, [maxOffsetPx, svgWidth, svgHeight, keepEyesClosed]);

  return (
    <div ref={containerRef} className={className} style={{ ...style, position: "relative", display: "inline-block" }}>
      <svg
        ref={svgRef}
        width="100%"
        height="100%"
        viewBox={`0 0 ${svgWidth} ${svgHeight}`}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        preserveAspectRatio="xMidYMid meet"
        aria-hidden="true"
        style={{ display: "block" }}
      >
        <g filter="url(#filter0_d_417_3063)">
          <path d="M93.8387 200.151C93.8387 200.151 24.8402 170.733 63.351 92.6421C63.351 92.6421 69.2346 75.5262 120.047 39.1549C120.047 39.1549 139.838 25.7831 130.21 3.85333C130.21 3.85333 129.14 0.109227 135.559 2.24871C141.977 4.3882 158.023 11.8764 168.186 33.2713C178.348 54.6662 195.999 70.1774 195.999 70.1774C195.999 70.1774 240.928 107.084 218.999 164.315C218.999 164.315 210.441 190.524 182.627 200.151C182.627 200.151 195.464 214.058 200.278 222.616C205.092 231.174 207.231 238.662 206.697 240.267C206.162 241.871 198.674 286.266 138.768 293.754C138.768 293.754 95.4433 294.824 69.7694 244.011C69.7694 244.011 67.0951 227.43 93.8387 200.151Z" fill="#EEB351" stroke="#EE990D" strokeWidth="1.17636" strokeMiterlimit="10"/>
          <path d="M88.4469 269.481C88.4469 269.481 81.5364 225.825 33.3979 236.523C33.3979 236.523 38.629 270.877 72.0424 271.535C76.8884 271.626 82.3334 271.011 88.4469 269.481Z" fill="url(#paint0_linear_417_3063)" stroke="#A7693B" strokeWidth="0.534872" strokeMiterlimit="10"/>
          <path d="M71.9086 271.824C71.9086 271.824 55.8625 275.033 51.5835 285.731C51.5835 285.731 70.0419 310.452 108.686 289.801C108.686 289.801 94.4428 282.468 87.7248 269.658C87.7194 269.658 71.9086 271.289 71.9086 271.824Z" fill="url(#paint1_linear_417_3063)" stroke="#A7693B" strokeWidth="0.534872" strokeMiterlimit="10"/>
          <path d="M187.891 269.481C187.891 269.481 194.801 225.825 242.94 236.523C242.94 236.523 237.709 270.877 204.295 271.535C199.444 271.626 193.999 271.011 187.891 269.481Z" fill="url(#paint2_linear_417_3063)" stroke="#A7693B" strokeWidth="0.534872" strokeMiterlimit="10"/>
          <path d="M204.429 271.824C204.429 271.824 220.475 275.033 224.754 285.731C224.754 285.731 206.295 310.452 167.651 289.801C167.651 289.801 181.895 282.468 188.613 269.658C188.613 269.658 204.429 271.289 204.429 271.824Z" fill="url(#paint3_linear_417_3063)" stroke="#A7693B" strokeWidth="0.534872" strokeMiterlimit="10"/>
          <path d="M75.118 205.5C75.118 205.5 63.3508 199.081 54.258 172.873C45.1652 146.664 24.8401 127.943 1.3057 121.525C1.3057 121.525 -5.64763 170.198 46.7698 189.988C46.7698 189.988 70.3042 201.221 75.118 205.5Z" fill="url(#paint4_linear_417_3063)"/>
          <path d="M76.1877 215.128C76.1877 215.128 64.9554 209.779 55.8625 202.291C46.7697 194.803 18.9564 189.454 10.3984 199.082C10.3984 199.082 18.4215 223.151 45.1651 221.011C45.1651 221.011 67.0949 215.128 76.1877 215.128Z" fill="url(#paint5_linear_417_3063)"/>
          <path d="M201.578 205.5C201.578 205.5 213.345 199.081 222.438 172.873C231.531 146.664 251.856 127.943 275.39 121.525C275.39 121.525 282.343 170.198 229.926 189.988C229.926 189.988 206.392 201.221 201.578 205.5Z" fill="url(#paint6_linear_417_3063)"/>
          <path d="M200.508 215.128C200.508 215.128 211.74 209.779 220.833 202.291C229.926 194.803 257.739 189.454 266.297 199.082C266.297 199.082 258.274 223.151 231.531 221.011C231.531 221.011 209.601 215.128 200.508 215.128Z" fill="url(#paint7_linear_417_3063)"/>
          {/* Commented out - ash colored background behind head */}
          {<g filter="url(#filter1_f_417_3063)">
            <path d="M207.996 125.411C207.996 166.62 176.864 200.026 138.462 200.026C100.06 200.026 68.394 172.503 68.394 131.295C68.394 90.0861 100.06 50.7964 138.462 50.7964C176.864 50.7964 207.996 84.2025 207.996 125.411Z" fill="#FFE5BA"/>
          </g> }
          
          {/* Smile */}
          <path d="M128.605 160.036C128.787 161.127 129.274 163.053 130.745 164.85C133.933 168.738 138.96 168.615 139.838 168.594C140.779 168.573 145.946 168.444 148.609 164.459C149.583 162.999 149.893 161.518 150 160.571C150.059 159.838 149.508 159.202 148.818 159.137C148.091 159.073 147.411 159.678 147.406 160.459C147.171 161.154 146.475 162.935 144.651 164.31C144.544 164.39 142.485 165.904 139.838 165.914C136.393 165.925 133.034 163.374 131.28 159.496C131.135 158.763 130.408 158.282 129.675 158.426C128.942 158.57 128.461 159.303 128.605 160.036Z" fill="black" stroke="black" strokeWidth="0.534872" strokeMiterlimit="10"/>
          
          {/* Blush */}
          <g filter="url(#filter2_f_417_3063)">
            <circle cx="99.4162" cy="161.515" r="6.95333" fill="#F29A9A"/>
          </g>
          <g filter="url(#filter3_f_417_3063)">
            <circle cx="180.717" cy="161.515" r="6.95333" fill="#F29A9A"/>
          </g>
          <g filter="url(#filter4_f_417_3063)">
            <path d="M110.99 222.156C100.402 229.802 105.696 250.389 106.284 252.741C135.929 291.797 159.417 269.799 167.455 253.918C168.827 247.056 171.219 231.92 169.808 226.273C168.043 219.215 149.221 215.686 141.575 212.745C133.929 209.804 121.577 214.51 110.99 222.156Z" fill="#FFE5BA"/>
          </g>
          <path d="M121.416 294.502C121.416 294.502 116.826 245.109 137.735 222.744C137.735 222.744 158.25 241.628 153.339 295.679" fill="url(#paint8_linear_417_3063)"/>
          <path d="M121.416 294.502C121.416 294.502 116.826 245.109 137.735 222.744C137.735 222.744 158.25 241.628 153.339 295.679" stroke="#A7693B" strokeWidth="0.534872" strokeMiterlimit="10"/>
          <path d="M89.0246 241.336C89.0246 241.336 72.4436 271.289 112.024 291.614C151.605 311.939 204.557 277.708 189.046 241.336C189.046 241.336 167.651 238.662 153.744 267.545C153.744 267.545 148.123 291.555 139.383 294.642C139.18 294.711 138.976 294.775 138.768 294.823C129.675 296.963 121.117 264.336 121.117 264.336C121.117 264.336 121.058 264.079 120.903 263.608C119.796 260.351 113.832 246.952 89.0246 241.336Z" fill="url(#paint9_linear_417_3063)"/>
        </g>

        {/* Eyes - Open */}
        <g ref={leftEyeGroupRef} style={{ opacity: eyesClosed ? 0 : 1, transition: 'opacity 0.2s' }}>
          <ellipse cx="106.5" cy="141.588" rx="13.5" ry="14" fill="white"/>
          <circle ref={leftPupilRef} cx="106.5" cy="141.588" r="7" fill="black"/>  {/* Increased from 6.5 to 7 */}
        </g>

        <g ref={rightEyeGroupRef} style={{ opacity: eyesClosed ? 0 : 1, transition: 'opacity 0.2s' }}>
          <ellipse cx="172.5" cy="141.588" rx="13.5" ry="14" fill="white"/>
          <circle ref={rightPupilRef} cx="172.5" cy="141.588" r="7" fill="black"/>  {/* Increased from 6.5 to 7 */}
        </g>

        {/* Eyes - Closed (curved lines) */}
        <g style={{ opacity: eyesClosed ? 1 : 0, transition: 'opacity 0.2s' }}>
          <path d="M93.3037 141.85C93.3358 143.241 93.6032 146.049 95.4432 148.804C98.9894 154.126 105.296 154.634 106.141 154.687C106.585 154.698 114.335 154.746 117.908 148.804C119.411 146.3 119.555 143.776 119.512 142.385C119.512 142.385 117.908 140.246 116.303 143.455C116.303 143.455 115.233 150.943 106.676 151.478C98.1176 152.013 95.9781 141.85 95.9781 141.85C95.9781 141.85 94.3735 139.711 93.3037 141.85Z" fill="black" stroke="black" strokeWidth="0.534872" strokeMiterlimit="10"/>
          <path d="M159 142.539C159.032 143.93 159.3 146.738 161.139 149.493C164.686 154.815 170.992 155.323 171.837 155.376C172.281 155.387 180.031 155.435 183.604 149.493C185.107 146.989 185.252 144.465 185.209 143.074C185.209 143.074 183.604 140.935 181.999 144.144C181.999 144.144 180.93 151.632 172.372 152.167C163.814 152.702 161.674 142.539 161.674 142.539C161.674 142.539 160.07 140.4 159 142.539Z" fill="black" stroke="black" strokeWidth="0.534872" strokeMiterlimit="10"/>
        </g>

        <defs>
          <filter id="filter0_d_417_3063" x="0" y="0" width="276.696" height="299.299" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
            <feFlood floodOpacity="0" result="BackgroundImageFix"/>
            <feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha"/>
            <feOffset/>
            <feGaussianBlur stdDeviation="0.5"/>
            <feComposite in2="hardAlpha" operator="out"/>
            <feColorMatrix type="matrix" values="0 0 0 0 0.305882 0 0 0 0 0.207843 0 0 0 0 0.101961 0 0 0 1 0"/>
            <feBlend mode="normal" in2="BackgroundImageFix" result="effect1_dropShadow_417_3063"/>
            <feBlend mode="normal" in="SourceGraphic" in2="effect1_dropShadow_417_3063" result="shape"/>
          </filter>
          <filter id="filter1_f_417_3063" x="36.3017" y="18.7041" width="203.786" height="213.414" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
            <feFlood floodOpacity="0" result="BackgroundImageFix"/><feBlend mode="normal" in="SourceGraphic" in2="BackgroundImageFix" result="shape"/><feGaussianBlur stdDeviation="5.88359" result="effect1_foregroundBlur_417_3063"/>
          </filter>
          <filter id="filter2_f_417_3063" x="79.0911" y="141.19" width="40.6503" height="40.6503" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
            <feFlood floodOpacity="0" result="BackgroundImageFix"/><feBlend mode="normal" in="SourceGraphic" in2="BackgroundImageFix" result="shape"/><feGaussianBlur stdDeviation="6.6859" result="effect1_foregroundBlur_417_3063"/>
          </filter>
          <filter id="filter3_f_417_3063" x="160.392" y="141.19" width="40.6503" height="40.6503" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
            <feFlood floodOpacity="0" result="BackgroundImageFix"/><feBlend mode="normal" in="SourceGraphic" in2="BackgroundImageFix" result="shape"/><feGaussianBlur stdDeviation="6.6859" result="effect1_foregroundBlur_417_3063"/>
          </filter>
          <filter id="filter4_f_417_3063" x="79.7398" y="187.156" width="115.203" height="112.169" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
            <feFlood floodOpacity="0" result="BackgroundImageFix"/><feBlend mode="normal" in="SourceGraphic" in2="BackgroundImageFix" result="shape"/><feGaussianBlur stdDeviation="12.3518" result="effect1_foregroundBlur_417_3063"/>
          </filter>
          <linearGradient id="paint0_linear_417_3063" x1="60.9224" y1="234.835" x2="60.9224" y2="271.544" gradientUnits="userSpaceOnUse">
            <stop stopColor="#8F6848"/><stop offset="1" stopColor="#533A1E"/>
          </linearGradient>
          <linearGradient id="paint1_linear_417_3063" x1="80.135" y1="269.658" x2="80.135" y2="298.031" gradientUnits="userSpaceOnUse">
            <stop stopColor="#8F6848"/><stop offset="1" stopColor="#533A1E"/>
          </linearGradient>
          <linearGradient id="paint2_linear_417_3063" x1="215.415" y1="234.835" x2="215.415" y2="271.544" gradientUnits="userSpaceOnUse">
            <stop stopColor="#AE7A51"/><stop offset="1" stopColor="#3B3116"/>
          </linearGradient>
          <linearGradient id="paint3_linear_417_3063" x1="196.202" y1="269.658" x2="196.202" y2="298.031" gradientUnits="userSpaceOnUse">
            <stop stopColor="#AE7A51"/><stop offset="1" stopColor="#3B3116"/>
          </linearGradient>
          <linearGradient id="paint4_linear_417_3063" x1="38.059" y1="121.525" x2="38.059" y2="205.5" gradientUnits="userSpaceOnUse">
            <stop stopColor="#5BA347"/><stop offset="1" stopColor="#2D3F28"/>
          </linearGradient>
          <linearGradient id="paint5_linear_417_3063" x1="43.2931" y1="193.889" x2="43.2931" y2="221.146" gradientUnits="userSpaceOnUse">
            <stop stopColor="#5BA347"/><stop offset="1" stopColor="#2D3F28"/>
          </linearGradient>
          <linearGradient id="paint6_linear_417_3063" x1="238.637" y1="121.525" x2="238.637" y2="205.5" gradientUnits="userSpaceOnUse">
            <stop stopColor="#5BA347"/><stop offset="1" stopColor="#2D3F28"/>
          </linearGradient>
          <linearGradient id="paint7_linear_417_3063" x1="233.403" y1="193.889" x2="233.403" y2="221.146" gradientUnits="userSpaceOnUse">
            <stop stopColor="#5BA347"/><stop offset="1" stopColor="#2D3F28"/>
          </linearGradient>
          <linearGradient id="paint8_linear_417_3063" x1="138.046" y1="222.744" x2="138.046" y2="294.502" gradientUnits="userSpaceOnUse">
            <stop stopColor="#795B43"/><stop offset="1" stopColor="#4D3B27"/>
          </linearGradient>
          <linearGradient id="paint9_linear_417_3063" x1="138.696" y1="241.271" x2="138.696" y2="297.688" gradientUnits="userSpaceOnUse">
            <stop stopColor="#805E43"/><stop offset="1" stopColor="#503A22"/>
          </linearGradient>
        </defs>
      </svg>
    </div>
  );
}