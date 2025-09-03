
/**
 * Ironclad-mode repository functionality
 * Provides advanced filtering, bulk selection, and details drawer
 */
class IroncladRepository {
    constructor() {
        this.selectedContracts = new Set();
        this.filters = {
            q: '',
            status: [],
            contract_type: [],
            sort: 'updated_desc',
            page: 1,
            page_size: 25
        };
        this.savedViews = this.loadSavedViews();
        this.currentUser = { role: 'admin' };
        
        this.init();
    }
    
    init() {
        this.setupEventListeners();
        this.renderFilterChips();
        this.renderSavedViews();
        this.setupKeyboardShortcuts();
        this.loadFromURL();
        this.loadContracts();
    }
    
    setupEventListeners() {
        // Search input with debounce
        let searchTimeout;
        const searchInput = document.getElementById('search-input');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                clearTimeout(searchTimeout);
                searchTimeout = setTimeout(() => {
                    this.filters.q = e.target.value;
                    this.loadContracts();
                    this.updateURL();
                }, 300);
            });
        }
        
        // Sort change
        const sortSelect = document.getElementById('sort-select');
        if (sortSelect) {
            sortSelect.addEventListener('change', (e) => {
                this.filters.sort = e.target.value;
                this.loadContracts();
                this.updateURL();
            });
        }
        
        // Select all checkbox
        const selectAllCheckbox = document.getElementById('select-all');
        if (selectAllCheckbox) {
            selectAllCheckbox.addEventListener('change', (e) => {
                const checkboxes = document.querySelectorAll('.contract-checkbox');
                checkboxes.forEach(cb => {
                    cb.checked = e.target.checked;
                    if (e.target.checked) {
                        this.selectedContracts.add(cb.value);
                    } else {
                        this.selectedContracts.delete(cb.value);
                    }
                });
                this.updateBulkActionBar();
            });
        }
    }
    
    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            if (e.key === '/' && !e.ctrlKey && !e.metaKey) {
                e.preventDefault();
                const searchInput = document.getElementById('search-input');
                if (searchInput) searchInput.focus();
            }
            
            if (e.key === 'Escape') {
                this.closeDetailsDrawer();
            }
            
            if (e.key === 'n' && !e.ctrlKey && !e.metaKey) {
                e.preventDefault();
                window.location.href = '/contracts/create/';
            }
        });
    }
    
    loadFromURL() {
        const params = new URLSearchParams(window.location.search);
        
        // Load filters from URL
        if (params.get('q')) this.filters.q = params.get('q');
        if (params.getAll('status').length) this.filters.status = params.getAll('status');
        if (params.get('sort')) this.filters.sort = params.get('sort');
        if (params.get('page')) this.filters.page = parseInt(params.get('page'));
        
        // Load contract detail if specified
        const contractId = params.get('contractId');
        if (contractId) {
            this.openDetailsDrawer(contractId);
        }
    }
    
    updateURL() {
        const params = new URLSearchParams();
        
        if (this.filters.q) params.set('q', this.filters.q);
        this.filters.status.forEach(s => params.append('status', s));
        if (this.filters.sort !== 'updated_desc') params.set('sort', this.filters.sort);
        if (this.filters.page !== 1) params.set('page', this.filters.page.toString());
        
        const newURL = window.location.pathname + '?' + params.toString();
        window.history.replaceState({}, '', newURL);
    }
    
    async loadContracts() {
        this.showLoading();
        
        try {
            const params = new URLSearchParams();
            if (this.filters.q) params.set('q', this.filters.q);
            this.filters.status.forEach(s => params.append('status', s));
            this.filters.contract_type.forEach(t => params.append('contract_type', t));
            params.set('sort', this.filters.sort);
            params.set('page', this.filters.page.toString());
            params.set('page_size', this.filters.page_size.toString());
            
            const response = await fetch(`/contracts/api/contracts/?${params.toString()}`);
            const result = await response.json();
            
            if (response.ok) {
                this.renderContracts(result);
                this.updatePagination(result);
            } else {
                this.showError(result.error || 'Failed to load contracts');
            }
        } catch (error) {
            this.showError('Network error: ' + error.message);
        } finally {
            this.hideLoading();
        }
    }
    
    renderContracts(result) {
        const tbody = document.getElementById('contracts-tbody');
        if (!tbody) return;
        
        if (result.contracts.length === 0) {
            tbody.innerHTML = `
                <tr><td colspan="6" class="text-center py-8 text-muted">
                    No contracts found. <a href="/contracts/create/" class="link">Create your first contract</a>
                </td></tr>
            `;
            return;
        }
        
        tbody.innerHTML = result.contracts.map(contract => `
            <tr class="contract-row hover:bg-hover cursor-pointer" data-contract-id="${contract.id}">
                <td class="px-3 py-2">
                    <input type="checkbox" class="contract-checkbox" value="${contract.id}">
                </td>
                <td class="px-3 py-2">
                    <div class="font-medium">${contract.title}</div>
                    <div class="text-sm text-muted">${contract.counterparty || 'No counterparty'}</div>
                </td>
                <td class="px-3 py-2">
                    <span class="status-badge status-${contract.status.toLowerCase()}">
                        ${contract.status}
                    </span>
                </td>
                <td class="px-3 py-2 text-muted">
                    ${contract.value ? '$' + contract.value.toLocaleString() : '-'}
                </td>
                <td class="px-3 py-2 text-muted">
                    ${contract.owner}
                </td>
                <td class="px-3 py-2 text-muted">
                    ${contract.updated_at ? new Date(contract.updated_at).toLocaleDateString() : '-'}
                </td>
            </tr>
        `).join('');
        
        // Add click handlers
        tbody.querySelectorAll('.contract-row').forEach(row => {
            row.addEventListener('click', (e) => {
                if (!e.target.matches('input[type="checkbox"]')) {
                    const contractId = row.dataset.contractId;
                    this.openDetailsDrawer(contractId);
                }
            });
        });
        
        // Add checkbox handlers
        tbody.querySelectorAll('.contract-checkbox').forEach(cb => {
            cb.addEventListener('change', (e) => {
                if (e.target.checked) {
                    this.selectedContracts.add(e.target.value);
                } else {
                    this.selectedContracts.delete(e.target.value);
                }
                this.updateBulkActionBar();
            });
        });
    }
    
    updateBulkActionBar() {
        const count = this.selectedContracts.size;
        const bulkBar = document.getElementById('bulk-action-bar');
        
        if (count > 0) {
            if (bulkBar) {
                bulkBar.style.display = 'flex';
                bulkBar.querySelector('#selected-count').textContent = `${count} selected`;
            }
        } else {
            if (bulkBar) bulkBar.style.display = 'none';
        }
    }
    
    async openDetailsDrawer(contractId) {
        const drawer = document.getElementById('details-drawer');
        if (!drawer) return;
        
        // Update URL
        const params = new URLSearchParams(window.location.search);
        params.set('contractId', contractId);
        window.history.replaceState({}, '', '?' + params.toString());
        
        // Show loading state
        drawer.innerHTML = '<div class="p-6">Loading...</div>';
        drawer.classList.add('active');
        
        try {
            const response = await fetch(`/contracts/api/contracts/${contractId}/`);
            const contract = await response.json();
            
            if (response.ok) {
                this.renderContractDetails(contract, drawer);
            } else {
                drawer.innerHTML = '<div class="p-6 text-danger">Failed to load contract details</div>';
            }
        } catch (error) {
            drawer.innerHTML = '<div class="p-6 text-danger">Network error</div>';
        }
    }
    
    renderContractDetails(contract, drawer) {
        drawer.innerHTML = `
            <div class="p-6">
                <div class="flex items-center justify-between mb-4">
                    <h2 class="text-xl font-semibold">${contract.title}</h2>
                    <button onclick="window.ironclad.closeDetailsDrawer()" class="btn-ghost">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                        </svg>
                    </button>
                </div>
                
                <div class="space-y-4">
                    <div>
                        <label class="text-sm text-muted">Status</label>
                        <div><span class="status-badge status-${contract.status.toLowerCase()}">${contract.status}</span></div>
                    </div>
                    
                    <div>
                        <label class="text-sm text-muted">Counterparty</label>
                        <div>${contract.counterparty || '-'}</div>
                    </div>
                    
                    <div>
                        <label class="text-sm text-muted">Value</label>
                        <div>${contract.value ? '$' + contract.value.toLocaleString() : '-'}</div>
                    </div>
                    
                    <div>
                        <label class="text-sm text-muted">Owner</label>
                        <div>${contract.owner}</div>
                    </div>
                    
                    <div>
                        <label class="text-sm text-muted">Content</label>
                        <div class="mt-1 p-3 bg-hover rounded text-sm">${contract.content || 'No content'}</div>
                    </div>
                </div>
                
                <div class="mt-6 pt-4 border-t flex space-x-2">
                    <a href="/contracts/${contract.id}/" class="btn-primary">Edit Contract</a>
                    <button onclick="window.ironclad.duplicateContract('${contract.id}')" class="btn-outline">Duplicate</button>
                </div>
            </div>
        `;
    }
    
    closeDetailsDrawer() {
        const drawer = document.getElementById('details-drawer');
        if (drawer) drawer.classList.remove('active');
        
        // Remove contractId from URL
        const params = new URLSearchParams(window.location.search);
        params.delete('contractId');
        window.history.replaceState({}, '', '?' + params.toString());
    }
    
    renderFilterChips() {
        // This would render filter chips UI
        console.log('Filter chips rendered');
    }
    
    renderSavedViews() {
        // This would render saved views UI
        console.log('Saved views rendered');
    }
    
    loadSavedViews() {
        try {
            return JSON.parse(localStorage.getItem('ironclad-saved-views') || '[]');
        } catch {
            return [];
        }
    }
    
    showLoading() {
        const table = document.getElementById('contracts-table');
        if (table) table.classList.add('loading');
    }
    
    hideLoading() {
        const table = document.getElementById('contracts-table');
        if (table) table.classList.remove('loading');
    }
    
    showError(message) {
        console.error('Repository error:', message);
        // Could show toast notification here
    }
    
    async duplicateContract(contractId) {
        // Placeholder for contract duplication
        alert('Contract duplication feature coming soon');
    }
}

// Initialize when DOM is loaded and ironclad mode is enabled
document.addEventListener('DOMContentLoaded', () => {
    if (window.location.pathname.includes('/repository')) {
        window.ironclad = new IroncladRepository();
    }
});
