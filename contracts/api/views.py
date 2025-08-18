
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
    """API endpoint for contract listing with filters"""
    try:
        # Parse query parameters
        q = request.GET.get('q')
        status_param = request.GET.getlist('status')
        contract_type_param = request.GET.getlist('contract_type')
        page = int(request.GET.get('page', 1))
        page_size = int(request.GET.get('page_size', 25))
        sort = request.GET.get('sort')
        
        # Convert status strings to enum
        status_list = None
        if status_param:
            status_list = [ContractStatus(s) for s in status_param if s]
        
        params = ListParams(
            q=q,
            status=status_list,
            contract_type=contract_type_param if contract_type_param else None,
            page=page,
            page_size=page_size,
            sort=sort
        )
        
        service = get_repository_service(request.user)
        result = service.list(params)
        
        return JsonResponse({
            'success': True,
            'data': {
                'rows': [
                    {
                        'id': row.id,
                        'title': row.title,
                        'counterparty': row.counterparty,
                        'status': row.status.value,
                        'hint': row.hint,
                        'updated_at': row.updated_at,
                        'contract_type': row.contract_type,
                        'value': row.value
                    } for row in result.rows
                ],
                'total': result.total,
                'page': result.page,
                'page_size': result.page_size
            }
        })
    except Exception as e:
        return JsonResponse({
            'success': False,
            'error': str(e)
        }, status=400)

@login_required
@csrf_exempt
@require_http_methods(["POST"])
def bulk_update_contracts(request):
    """API endpoint for bulk updating contracts"""
    try:
        data = json.loads(request.body)
        ids = data.get('ids', [])
        patch = data.get('patch', {})
        
        service = get_repository_service(request.user)
        service.bulk_update(ids, patch)
        
        return JsonResponse({
            'success': True,
            'message': f'Updated {len(ids)} contracts'
        })
    except Exception as e:
        return JsonResponse({
            'success': False,
            'error': str(e)
        }, status=400)

@login_required
@require_http_methods(["GET"])
def contract_detail_api(request, contract_id):
    """API endpoint for getting contract details"""
    try:
        service = get_repository_service(request.user)
        contract = service.get(contract_id)
        
        return JsonResponse({
            'success': True,
            'data': {
                'id': contract.id,
                'title': contract.title,
                'counterparty': contract.counterparty,
                'status': contract.status.value,
                'hint': contract.hint,
                'updated_at': contract.updated_at,
                'contract_type': contract.contract_type,
                'value': contract.value
            }
        })
    except Exception as e:
        return JsonResponse({
            'success': False,
            'error': str(e)
        }, status=404)
