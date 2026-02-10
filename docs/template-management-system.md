# Report Card Template Management System

## Overview
यह system अब सभी schools को अपने progress report cards के लिए multiple templates create, manage और customize करने की flexibility देता है।

## Key Features

### 1. **Template Management Page** (`TemplateManagement.tsx`)
- **Path**: `/exams/template-management`
- **Features**:
  - सभी available templates को browse करें (Public + School's own)
  - New custom templates create करें
  - Existing templates को edit करें (only school's own templates)
  - Templates को duplicate करें (किसी भी template से)
  - Templates को delete करें (only school's own templates)
  - School के लिए default template select करें

### 2. **Template Properties**
Each template contains:
- **Basic Info**:
  - Name (e.g., "Template 1", "Modern Design")
  - Description
  - Accent Color
  
- **Features**:
  - Show Logo (On/Off)
  - Include Graphs (On/Off)
  - Include Remarks (On/Off)
  - Header Style (Modern/Classic/Minimal)
  - Font Family
  
- **Report Type Support**:
  - Single Exam Report (supportsSingle)
  - Multi/Combined Exam Report (supportsMulti)
  
- **Visibility**:
  - Public (visible to all schools)
  - Private (only creator school)
  - Default (recommended template)

### 3. **School Context Updates** (`SchoolContext.tsx`)
- Added `selectedReportCardTemplateId` field to SchoolData interface
- Added `updateSchoolData()` function to dynamically update school settings
- Schools can now save their preferred template selection

### 4. **Report Cards Integration** (`ReportCards.tsx`)
- Dynamic template loading from Firestore
- Templates automatically load from `report_card_templates` collection
- Templates filter by: Public templates + School's own templates
- Auto-selects school's preferred template
- "Manage Templates" link to navigate to template management page

### 5. **Default Template Setup** (`createDefaultTemplate.ts`)
- Utility script to create "Template 1" as the default public template
- Can be run from browser console or admin panel
- Creates a fully-featured template with:
  - Modern aesthetics
  - Support for both single and multi-exam reports
  - Graphs and remarks enabled
  - Customizable signatures

## Database Structure

### Collection: `report_card_templates`
```typescript
{
  id: string (auto-generated)
  name: string
  description: string
  accentColor: string (hex color)
  headerStyle: 'modern' | 'classic' | 'minimal'
  fontFamily: string
  showLogo: boolean
  includeGraphs: boolean
  includeRemarks: boolean
  signatures: {
    teacher: string
    incharge: string
    principal: string
  }
  customMessage: string
  schoolId?: string  // null for public templates
  isPublic: boolean
  isDefault: boolean
  supportsSingle: boolean
  supportsMulti: boolean
  createdAt: string (ISO timestamp)
  updatedAt: string (ISO timestamp)
  createdBy: string (user ID)
}
```

### School Document Update
```typescript
{
  // ... existing fields
  selectedReportCardTemplateId?: string
}
```

## Usage Workflow

### For School Admins:

1. **First Time Setup**:
   - Navigate to `/exams/template-management`
   - Browser करें available public templates (including "Template 1")
   - Select एक template जो school की requirements match करता है
   - Click "Select Template" to activate it

2. **Creating Custom Template**:
   - Click "Create New Template"
   - Fill in template details:
     - Name और description
     - Colors और style preferences
     - Features to include/exclude
     - Report type support (single/multi)
   - Choose visibility (Public या Private)
   - Click "Create Template"

3. **Editing Existing Template**:
   - Find the template (only school's own templates can be edited)
   - Click "Edit" icon
   - Make changes
   - Click "Update Template"

4. **Duplicating Templates**:
   - Find any template (public या own)
   - Click "Duplicate" icon
   - Template की copy create होगी with "(Copy)" suffix
   - Edit करें और customize करें as needed
   - Save करें

5. **Using Templates in Report Cards**:
   - Navigate to `/exams/report-cards`
   - Templates automatically show based on school's selection
   - Override settings temporarily for specific prints if needed
   - Click "Manage Templates" to go to template management page

## Initial Setup Steps

### Step 1: Create Default Template
Browser console में run करें:
```javascript
// Import the function first
import { createDefaultTemplate } from './utils/createDefaultTemplate';

// Then execute
await createDefaultTemplate();
```

### Step 2: Set School's Default Template
प्रत्येक school के लिए:
1. Go to Template Management page
2. Select "Template 1" (या कोई भी preferred template)
3. Click "Select Template"

## Migration Notes

### Old System → New System
- **Before**: Hardcoded TEMPLATES array में fixed templates
- **After**: Dynamic Firestore-based templates
- **Benefits**:
  - Schools can create unlimited custom templates
  - Templates can be shared across schools (public templates)
  - Each school can have its unique design
  - Easy to update and maintain

### Backward Compatibility
- Existing report card generation still works
- If no template is selected, first available template is used
- Old exam_templates collection can coexist

## Technical Architecture

### Component Flow:
```
TemplateManagement.tsx
  ↓
  ├→ Firestore: report_card_templates (CRUD operations)
  ├→ SchoolContext: updateSchoolData()
  └→ Selected template ID saved in school document

ReportCards.tsx
  ↓
  ├→ Loads templates from Firestore
  ├→ Filters by (isPublic || schoolId === currentSchool.id)
  ├→ Uses school's selectedReportCardTemplateId
  ├→ Renders report cards with selected template
  └→ Link to TemplateManagement for customization
```

### State Management:
- Templates: Firestore collection `report_card_templates`
- School preference: `SchoolContext.currentSchool.selectedReportCardTemplateId`
- Real-time updates: useFirestore hook ensures automatic sync

## Best Practices

1. **Template Naming**: Use descriptive names like "Modern Blue", "Classic Academic", etc.
2. **Public Templates**: Only mark as public if truly reusable across schools
3. **Testing**: Always preview report cards after template changes
4. **Backup**: Keep at least one working template before major edits
5. **Performance**: Limit custom messages to reasonable length

## Future Enhancements

Possible additions:
- [ ] Template preview before selection
- [ ] Template versioning
- [ ] Template marketplace
- [ ] Advanced customization (CSS injection)
- [ ] Multi-language support
- [ ] Template categories/tags
- [ ] Import/Export templates
- [ ] Template analytics (usage stats)

## Support

For issues or questions:
1. Check template configuration in Template Management page
2. Verify school's selected template ID in school settings
3. Ensure proper permissions (MANAGE_EXAMS, PRINT_REPORT_CARDS)
4. Check browser console for errors

---

**Status**: ✅ Implemented and Ready to Use
**Created**: 2026-02-08
**Version**: 1.0.0
