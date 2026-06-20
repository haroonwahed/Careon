from django.db import models


class CareCategoryMain(models.Model):
    """Main care question categories (Hoofdcategorieën Zorgvraag)"""
    class Meta:
        ordering = ['order', 'name']
        verbose_name = 'Care Category (Main)'
        verbose_name_plural = 'Care Categories (Main)'

    code = models.CharField(max_length=64, blank=True, default='', db_index=True)
    name = models.CharField(max_length=100, unique=True)
    description = models.TextField(blank=True)
    order = models.PositiveIntegerField(default=0)
    is_active = models.BooleanField(default=True)
    visible_in_mvp = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name


class CareCategorySubcategory(models.Model):
    """Subcategories for care questions (Subcategorieën Zorgvraag)"""
    class Meta:
        ordering = ['order', 'name']
        verbose_name = 'Care Subcategory'
        verbose_name_plural = 'Care Subcategories'

    main_category = models.ForeignKey(CareCategoryMain, on_delete=models.CASCADE, related_name='subcategories')
    code = models.CharField(max_length=64, blank=True, default='', db_index=True)
    name = models.CharField(max_length=100)
    description = models.TextField(blank=True)
    order = models.PositiveIntegerField(default=0)
    is_active = models.BooleanField(default=True)
    visible_in_mvp = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f'{self.main_category.name} → {self.name}'


class RiskFactor(models.Model):
    """Signal factors for client profile"""
    class Meta:
        ordering = ['name']
        verbose_name = 'Signaalfactor'
        verbose_name_plural = 'Signaalfactoren'

    FACTOR_CHOICES = [
        ('DEBT', 'Schulden'),
        ('VIOLENCE', 'Geweld'),
        ('ADDICTION', 'Verslaving'),
        ('MENTAL_HEALTH', 'Psychische problematiek'),
        ('HOMELESSNESS', 'Huisvesting'),
        ('SOCIAL_ISOLATION', 'Sociale isolatie'),
        ('EMPLOYMENT', 'Werkloosheid'),
        ('GOVERNANCE', 'Regelgevingsvragen'),
        ('TRAUMA', 'Trauma'),
        ('OTHER', 'Anderszins'),
    ]

    name = models.CharField(max_length=100, unique=True, choices=FACTOR_CHOICES)
    description = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)

    def __str__(self):
        return self.get_name_display()
