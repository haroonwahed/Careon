
"""
API views for Ironclad-mode functionality
"""
import json
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from django.contrib.auth.decorators import login_required
from contracts.services.repository import get_repository_service
from contracts.domain.contracts import ListParams, ContractStatus

@login_required
@require_http_methods(["GET"])
def contracts_api(request):
    """
    API endpoint for listing contracts with filtering and pagination
    Used by Ironclad repository UI
    """
    try:
        # Get service
        service = get_repository_service(request.user, use_mock=False)
        
        # Parse filters from request
        params = ListParams(
            q=request.GET.get('q', ''),
            status=[s for s in request.GET.getlist('status') if s],
            contract_type=[t for t in request.GET.getlist('contract_type') if t],
            sort=request.GET.get('sort', 'updated_desc'),
            page=int(request.GET.get('page', 1)),
            page_size=int(request.GET.get('page_size', 25))
        )
        
        # Get results
        result = service.list(params)
        
        return JsonResponse(result.to_dict())
        
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)

@login_required
@require_http_methods(["GET"])
def contract_detail_api(request, contract_id):
    """Get single contract details"""
    try:
        service = get_repository_service(request.user, use_mock=False)
        contract = service.get_by_id(contract_id)
        
        if not contract:
            return JsonResponse({'error': 'Contract not found'}, status=404)
            
        return JsonResponse(contract.to_dict())
        
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)

@csrf_exempt
@login_required
@require_http_methods(["POST"])
def contracts_bulk_update_api(request):
    """Bulk update contracts"""
    try:
        data = json.loads(request.body)
        contract_ids = data.get('contract_ids', [])
        updates = data.get('updates', {})
        
        service = get_repository_service(request.user, use_mock=False)
        result = service.bulk_update(contract_ids, updates)
        
        return JsonResponse({'success': True, 'updated_count': result})
        
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)
