from django.shortcuts import redirect
from django.contrib.auth.decorators import login_required
from django.urls import reverse


@login_required
def case_flow_list_redirect(request, step=None):
    """Route legacy list entry points to the case-first workspace."""
    target = reverse('carelane:case_list')
    if step:
        target = f'{target}?flow={step}'
    return redirect(target)


@login_required
def case_flow_create_redirect(request, step=None):
    """Route legacy create entry points to the canonical SPA intake route."""
    target = reverse('spa_nieuwe_casus')
    if step:
        target = f'{target}?flow={step}'
    return redirect(target)


@login_required
def redirect_case_intake_create_to_spa(request):
    """Retire Django intake_form at /care/casussen/new/ — SPA owns nieuwe casus."""
    return redirect('spa_nieuwe_casus')


@login_required
def redirect_casussen_list_to_spa(request):
    """Retire Django CaseIntakeListView — SPA owns the casussen werklijst at /casussen/."""
    target = '/casussen/'
    flow = request.GET.get('flow')
    if flow:
        target = f'{target}?flow={flow}'
    return redirect(target)


@login_required
def case_flow_detail_redirect(request, pk):
    """Route legacy intake detail URLs to the canonical case detail page."""
    return redirect('carelane:case_detail', pk=pk)


@login_required
def case_flow_update_redirect(request, pk):
    """Route legacy intake edit URLs to the canonical case edit page."""
    return redirect('carelane:case_update', pk=pk)
