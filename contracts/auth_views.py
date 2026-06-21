"""Rate-limited Django form login (HTML) — complements SPA JSON auth_login_api."""
from django.contrib.auth import views as auth_views
from django.contrib.auth.forms import AuthenticationForm
from django.core.exceptions import ValidationError

from contracts.auth_rate_limit import (
    check_login_allowed,
    clear_login_attempts,
    is_login_locked,
    lockout_user_message,
    record_failed_login,
)


class RateLimitedAuthenticationForm(AuthenticationForm):
    def confirm_login_allowed(self, user):
        super().confirm_login_allowed(user)
        clear_login_attempts(self.request, self.cleaned_data.get('username', ''))

    def clean(self):
        username = (self.data.get('username') or '').strip()
        if is_login_locked(self.request, username):
            _, retry_after = check_login_allowed(self.request, username)
            raise ValidationError(lockout_user_message(retry_after), code='login_locked')

        allowed, retry_after = check_login_allowed(self.request, username)
        if not allowed:
            raise ValidationError(lockout_user_message(retry_after), code='login_locked')

        try:
            return super().clean()
        except ValidationError:
            record_failed_login(self.request, username)
            raise


class RateLimitedLoginView(auth_views.LoginView):
    authentication_form = RateLimitedAuthenticationForm

    def form_valid(self, form):
        clear_login_attempts(self.request, form.cleaned_data.get('username', ''))
        return super().form_valid(form)
