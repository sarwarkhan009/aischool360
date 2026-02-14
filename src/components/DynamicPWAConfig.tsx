import { useEffect } from 'react';
import { useSchool } from '../context/SchoolContext';

/**
 * Dynamic PWA Configuration Component
 * 
 * This component dynamically updates the PWA manifest and browser branding
 * based on the current school's configuration. It handles:
 * - Dynamic browser title and favicon
 * - Dynamic PWA manifest for installation
 * - School-specific branding on installed apps
 */
export const DynamicPWAConfig = () => {
    const { currentSchool, loading } = useSchool();

    useEffect(() => {
        if (loading) return;

        // 1. Update Document Title
        const pageTitle = currentSchool?.customTitle || currentSchool?.name || 'AI School 360';
        document.title = pageTitle;

        if (!currentSchool) return;

        // 2. Update Favicon
        if (currentSchool.logoUrl || currentSchool.logo) {
            const logoUrl = currentSchool.logoUrl || currentSchool.logo;

            // Remove existing favicon links
            const existingFavicons = document.querySelectorAll('link[rel*="icon"]');
            existingFavicons.forEach(link => link.remove());

            // Add new favicon
            const favicon = document.createElement('link');
            favicon.rel = 'icon';
            favicon.type = 'image/png';
            favicon.href = logoUrl!;
            document.head.appendChild(favicon);

            // Add apple-touch-icon for iOS
            const appleTouchIcon = document.createElement('link');
            appleTouchIcon.rel = 'apple-touch-icon';
            appleTouchIcon.href = logoUrl!;
            document.head.appendChild(appleTouchIcon);
        }

        // 3. Generate Dynamic PWA Manifest
        const generateDynamicManifest = () => {
            const logo = currentSchool.logoUrl || currentSchool.logo || '/logo.png';
            const absoluteLogo = logo.startsWith('http') ? logo : `${window.location.origin}${logo.startsWith('/') ? '' : '/'}${logo}`;

            const manifest = {
                name: currentSchool.fullName || currentSchool.name,
                short_name: currentSchool.name,
                description: `${currentSchool.name} - AI School Management System`,
                start_url: `${window.location.origin}/${currentSchool.id}/`,
                scope: `${window.location.origin}/${currentSchool.id}/`,
                display: 'standalone',
                background_color: '#ffffff',
                theme_color: currentSchool.themeColor || '#6366f1',
                icons: [
                    {
                        src: absoluteLogo,
                        sizes: '192x192',
                        type: 'image/png',
                        purpose: 'any'
                    },
                    {
                        src: absoluteLogo,
                        sizes: '512x512',
                        type: 'image/png',
                        purpose: 'any maskable'
                    }
                ]
            };

            // Remove existing manifest links
            const existingManifests = document.querySelectorAll('link[rel="manifest"]');
            existingManifests.forEach(link => link.remove());

            // Create blob from manifest object
            const manifestBlob = new Blob(
                [JSON.stringify(manifest)],
                { type: 'application/json' }
            );
            const manifestURL = URL.createObjectURL(manifestBlob);

            // Inject new manifest
            const manifestLink = document.createElement('link');
            manifestLink.rel = 'manifest';
            manifestLink.href = manifestURL;
            document.head.appendChild(manifestLink);
        };

        generateDynamicManifest();

        // 4. Update theme-color meta tag
        let themeColorMeta = document.querySelector('meta[name="theme-color"]');
        if (!themeColorMeta) {
            themeColorMeta = document.createElement('meta');
            themeColorMeta.setAttribute('name', 'theme-color');
            document.head.appendChild(themeColorMeta);
        }
        themeColorMeta.setAttribute('content', currentSchool.themeColor || '#6366f1');

        // 5. Update mobile-web-app-capable (Modern standard)
        let mobileWebAppCapable = document.querySelector('meta[name="mobile-web-app-capable"]');
        if (!mobileWebAppCapable) {
            mobileWebAppCapable = document.createElement('meta');
            mobileWebAppCapable.setAttribute('name', 'mobile-web-app-capable');
            document.head.appendChild(mobileWebAppCapable);
        }
        mobileWebAppCapable.setAttribute('content', 'yes');

        // 6. Update apple-mobile-web-app-capable for iOS (Legacy)
        let appleMobileWebAppCapable = document.querySelector('meta[name="apple-mobile-web-app-capable"]');
        if (!appleMobileWebAppCapable) {
            appleMobileWebAppCapable = document.createElement('meta');
            appleMobileWebAppCapable.setAttribute('name', 'apple-mobile-web-app-capable');
            document.head.appendChild(appleMobileWebAppCapable);
        }
        appleMobileWebAppCapable.setAttribute('content', 'yes');

        // 7. Update apple-mobile-web-app-status-bar-style
        let appleStatusBar = document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]');
        if (!appleStatusBar) {
            appleStatusBar = document.createElement('meta');
            appleStatusBar.setAttribute('name', 'apple-mobile-web-app-status-bar-style');
            document.head.appendChild(appleStatusBar);
        }
        appleStatusBar.setAttribute('content', 'default');

        // 8. Update apple-mobile-web-app-title
        let appleTitle = document.querySelector('meta[name="apple-mobile-web-app-title"]');
        if (!appleTitle) {
            appleTitle = document.createElement('meta');
            appleTitle.setAttribute('name', 'apple-mobile-web-app-title');
            document.head.appendChild(appleTitle);
        }
        appleTitle.setAttribute('content', currentSchool.name);

        // 9. Update Open Graph Meta Tags
        let ogTitle = document.querySelector('meta[property="og:title"]');
        if (!ogTitle) {
            ogTitle = document.createElement('meta');
            ogTitle.setAttribute('property', 'og:title');
            document.head.appendChild(ogTitle);
        }
        ogTitle.setAttribute('content', pageTitle);

        let ogSiteName = document.querySelector('meta[property="og:site_name"]');
        if (!ogSiteName) {
            ogSiteName = document.createElement('meta');
            ogSiteName.setAttribute('property', 'og:site_name');
            document.head.appendChild(ogSiteName);
        }
        ogSiteName.setAttribute('content', currentSchool.name);

        if (currentSchool.logoUrl || currentSchool.logo) {
            let ogImage = document.querySelector('meta[property="og:image"]');
            if (!ogImage) {
                ogImage = document.createElement('meta');
                ogImage.setAttribute('property', 'og:image');
                document.head.appendChild(ogImage);
            }
            ogImage.setAttribute('content', currentSchool.logoUrl || currentSchool.logo || '');
        }

    }, [currentSchool, loading]);

    // This component doesn't render anything
    return null;
};

export default DynamicPWAConfig;
