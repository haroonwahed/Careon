from django.shortcuts import render
from django.utils.cache import patch_cache_control


_SAFE_ERROR_COPY = {
    403: {
        'title': 'Geen toegang',
        'message': 'Deze pagina hoort niet bij jouw rol of je mist de juiste toegang.',
        'primary_label': 'Naar dashboard',
        'primary_href_name': 'dashboard',
        'secondary_label': 'Naar casussen',
        'secondary_href_name': 'careon:case_list',
    },
    404: {
        'title': 'Pagina niet gevonden',
        'message': 'Deze pagina bestaat niet of is niet beschikbaar binnen jouw rol.',
        'primary_label': 'Naar dashboard',
        'primary_href_name': 'dashboard',
        'secondary_label': 'Naar casussen',
        'secondary_href_name': 'careon:case_list',
    },
    500: {
        'title': 'Er ging iets mis',
        'message': 'Probeer het opnieuw of ga terug naar het overzicht.',
        'primary_label': 'Naar dashboard',
        'primary_href_name': 'dashboard',
        'secondary_label': 'Naar casussen',
        'secondary_href_name': 'careon:case_list',
    },
}


def render_safe_error_page(request, status_code: int, template_name: str):
    copy = _SAFE_ERROR_COPY.get(status_code, _SAFE_ERROR_COPY[404])
    context = {
        'error_title': copy['title'],
        'error_message': copy['message'],
        'primary_label': copy['primary_label'],
        'primary_href_name': copy['primary_href_name'],
        'secondary_label': copy['secondary_label'],
        'secondary_href_name': copy['secondary_href_name'],
        'status_code': status_code,
    }
    response = render(request, template_name, context, status=status_code)
    patch_cache_control(
        response,
        no_cache=True,
        no_store=True,
        must_revalidate=True,
        private=True,
        max_age=0,
    )
    response['Pragma'] = 'no-cache'
    response['Expires'] = '0'
    return response
