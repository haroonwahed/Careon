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
from django.urls import path, include, re_path
from django.views.generic import RedirectView
from django.conf import settings
from django.conf.urls.static import static
from contracts import views as careon_views

from django.contrib.auth import views as auth_views

urlpatterns = [
    path('admin/', admin.site.urls),
    path('', careon_views.index, name='index'),
    path('favicon.ico', careon_views.favicon, name='favicon'),
    path('_health/', careon_views.health_check, name='health_check'),
    path('build-info/', careon_views.build_info, name='build_info'),
    path('ops/system-state/', careon_views.ops_system_state, name='ops_system_state'),
    path(
        'internal/build-info/',
        RedirectView.as_view(pattern_name='ops_system_state', permanent=False),
        name='internal_build_info_redirect',
    ),
    path('dashboard/', careon_views.dashboard, name='dashboard'),
    path('care/', include(('contracts.urls', 'careon'), namespace='careon')),
    path('profile/', careon_views.profile, name='profile'),
    path('settings/', careon_views.settings_hub, name='settings_hub'),
    path('settings/design-mode/', careon_views.design_mode_settings, name='design_mode_settings'),
    path('register/', careon_views.SignUpView.as_view(), name='register'),
    path('login/', auth_views.LoginView.as_view(redirect_authenticated_user=True), name='login'),
    path('logout/', auth_views.LogoutView.as_view(), name='logout'),
    path('password-reset/', auth_views.PasswordResetView.as_view(), name='password_reset'),
    path('password-reset/done/', auth_views.PasswordResetDoneView.as_view(), name='password_reset_done'),
    path('password-reset/<uidb64>/<token>/', auth_views.PasswordResetConfirmView.as_view(), name='password_reset_confirm'),
    path('password-reset/complete/', auth_views.PasswordResetCompleteView.as_view(), name='password_reset_complete'),
    # Named SPA entry points (served by the same shell as the catch-all, but
    # reversible by name so server-side redirects can target them).
    path('casussen/nieuw/', careon_views.dashboard, name='spa_nieuwe_casus'),
    # Catch-all: serve the SPA shell for all client-side routes not matched above.
    re_path(r'^(?!admin/|care/|static/|media/|favicon\.ico|_health/|build-info/|ops/|internal/|profile/|settings/|register/|login/|logout/|oidc/).*$', careon_views.dashboard, name='spa_catchall'),
]

if settings.DEBUG and getattr(settings, 'ENABLE_DJANGO_BROWSER_RELOAD', False):
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

handler403 = 'contracts.views.handler403'
handler404 = 'contracts.views.handler404'
handler500 = 'contracts.views.handler500'
