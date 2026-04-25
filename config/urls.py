"""
URL configuration for config project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/5.2/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.contrib import admin
from django.contrib.staticfiles.urls import staticfiles_urlpatterns
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from contracts import views as careon_views

from django.contrib.auth import views as auth_views

urlpatterns = [
    path('admin/', admin.site.urls),
    path('', careon_views.index, name='index'),
    path('favicon.ico', careon_views.favicon, name='favicon'),
    path('_health/', careon_views.health_check, name='health_check'),
    path('dashboard/', careon_views.dashboard, name='dashboard'),
    path('care/', include(('contracts.urls', 'careon'), namespace='careon')),
    path('profile/', careon_views.profile, name='profile'),
    path('settings/', careon_views.settings_hub, name='settings_hub'),
    path('settings/design-mode/', careon_views.design_mode_settings, name='design_mode_settings'),
    path('register/', careon_views.SignUpView.as_view(), name='register'),
    path('login/', auth_views.LoginView.as_view(), name='login'),
    path('logout/', auth_views.LogoutView.as_view(), name='logout'),
    path('toggle-redesign/', careon_views.toggle_redesign, name='toggle_redesign'),
]

if settings.DEBUG:
    try:
        import django_browser_reload.urls  # noqa: F401
    except ModuleNotFoundError:
        pass
    else:
        urlpatterns.append(path('__reload__/', include('django_browser_reload.urls')))

if settings.SSO_ENABLED:
    urlpatterns.append(path('oidc/', include('mozilla_django_oidc.urls')))

if settings.DEBUG:
    urlpatterns += staticfiles_urlpatterns()
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
