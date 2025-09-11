import { createRoute, type RootRoute } from "@tanstack/react-router";
import { useState } from "react";
import { 
  FileText, 
  Users, 
  List, 
  Image, 
  Plus,
  Search,
  Filter,
  Eye,
  Edit,
  Trash2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { UserButton } from "@/components/user-button";

// Mock data para demonstração
const mockLetterheads = [
  { id: 1, name: "Papel Timbrado Oficial", fileType: "pdf", active: true, createdAt: new Date() },
  { id: 2, name: "Papel Simples", fileType: "png", active: true, createdAt: new Date() },
];

const mockTemplates = [
  { id: 1, type: "convite", name: "Convite Iniciação", description: "Template para convites de iniciação", active: true },
  { id: 2, type: "oficio", name: "Ofício Padrão", description: "Template para ofícios oficiais", active: true },
];

const mockDocuments = [
  { id: 1, title: "Convite Iniciação João Silva", templateType: "convite", isPublic: true, createdAt: new Date() },
  { id: 2, title: "Ofício Reunião Mensal", templateType: "oficio", isPublic: false, createdAt: new Date() },
];

const mockRecipients = [
  { id: 1, name: "João Silva", email: "joao@email.com", tags: ["candidato"], active: true },
  { id: 2, name: "Maria Santos", email: "maria@email.com", tags: ["membro"], active: true },
];

const mockLists = [
  { id: 1, name: "Candidatos 2024", recipientCount: 5, active: true },
  { id: 2, name: "Membros Ativos", recipientCount: 15, active: true },
];

function StatsCard({ title, value, icon: Icon, color }: { 
  title: string; 
  value: number; 
  icon: any; 
  color: string;
}) {
  return (
    <div className="bg-slate-800 border border-slate-700 rounded-lg p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-slate-400">{title}</p>
          <p className="text-2xl font-bold text-white">{value}</p>
        </div>
        <Icon className={`w-8 h-8 ${color}`} />
      </div>
    </div>
  );
}

function SectionCard({ 
  title, 
  items, 
  onAdd, 
  onView, 
  onEdit, 
  onDelete,
  columns 
}: {
  title: string;
  items: any[];
  onAdd: () => void;
  onView?: (item: any) => void;
  onEdit?: (item: any) => void;
  onDelete?: (item: any) => void;
  columns: { key: string; label: string; render?: (value: any, item: any) => React.ReactNode }[];
}) {
  return (
    <div className="bg-slate-800 border border-slate-700 rounded-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-medium text-white">{title}</h3>
        <Button onClick={onAdd} size="sm" className="bg-blue-600 hover:bg-blue-500">
          <Plus className="w-4 h-4 mr-2" />
          Adicionar
        </Button>
      </div>
      
      {items.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-slate-400">Nenhum item encontrado</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700">
                {columns.map((col) => (
                  <th key={col.key} className="text-left py-2 px-3 text-slate-300 font-medium">
                    {col.label}
                  </th>
                ))}
                <th className="text-right py-2 px-3 text-slate-300 font-medium">Ações</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="border-b border-slate-700/50 hover:bg-slate-700/30">
                  {columns.map((col) => (
                    <td key={col.key} className="py-3 px-3 text-slate-200">
                      {col.render ? col.render(item[col.key], item) : item[col.key]}
                    </td>
                  ))}
                  <td className="py-3 px-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {onView && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => onView(item)}
                          className="h-8 w-8 p-0 text-slate-400 hover:text-white"
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                      )}
                      {onEdit && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => onEdit(item)}
                          className="h-8 w-8 p-0 text-slate-400 hover:text-white"
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                      )}
                      {onDelete && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => onDelete(item)}
                          className="h-8 w-8 p-0 text-slate-400 hover:text-red-400"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function DeMolayPage() {
  const [activeTab, setActiveTab] = useState<'letterheads' | 'templates' | 'documents' | 'recipients' | 'lists'>('letterheads');

  const handleAction = (action: string, item?: any) => {
    console.log(`Ação: ${action}`, item);
    // TODO: Implementar ações reais com as APIs
    alert(`Ação "${action}" será implementada em breve!`);
  };

  const tabs = [
    { id: 'letterheads', label: 'Papel Timbrado', icon: Image },
    { id: 'templates', label: 'Templates', icon: FileText },
    { id: 'documents', label: 'Documentos', icon: FileText },
    { id: 'recipients', label: 'Destinatários', icon: Users },
    { id: 'lists', label: 'Listas', icon: List },
  ];

  const renderTabContent = () => {
    switch (activeTab) {
      case 'letterheads':
        return (
          <SectionCard
            title="Papéis Timbrados"
            items={mockLetterheads}
            onAdd={() => handleAction('add-letterhead')}
            onView={(item) => handleAction('view-letterhead', item)}
            onEdit={(item) => handleAction('edit-letterhead', item)}
            onDelete={(item) => handleAction('delete-letterhead', item)}
            columns={[
              { key: 'name', label: 'Nome' },
              { 
                key: 'fileType', 
                label: 'Tipo',
                render: (value) => (
                  <span className="px-2 py-1 bg-slate-700 text-slate-300 rounded text-xs uppercase">
                    {value}
                  </span>
                )
              },
              { 
                key: 'active', 
                label: 'Status',
                render: (value) => (
                  <span className={`px-2 py-1 rounded text-xs ${
                    value ? 'bg-green-900 text-green-300' : 'bg-red-900 text-red-300'
                  }`}>
                    {value ? 'Ativo' : 'Inativo'}
                  </span>
                )
              },
            ]}
          />
        );

      case 'templates':
        return (
          <SectionCard
            title="Templates de Documentos"
            items={mockTemplates}
            onAdd={() => handleAction('add-template')}
            onView={(item) => handleAction('view-template', item)}
            onEdit={(item) => handleAction('edit-template', item)}
            onDelete={(item) => handleAction('delete-template', item)}
            columns={[
              { key: 'name', label: 'Nome' },
              { 
                key: 'type', 
                label: 'Tipo',
                render: (value) => (
                  <span className="px-2 py-1 bg-blue-900 text-blue-300 rounded text-xs capitalize">
                    {value}
                  </span>
                )
              },
              { key: 'description', label: 'Descrição' },
            ]}
          />
        );

      case 'documents':
        return (
          <SectionCard
            title="Documentos Gerados"
            items={mockDocuments}
            onAdd={() => handleAction('add-document')}
            onView={(item) => handleAction('view-document', item)}
            onEdit={(item) => handleAction('edit-document', item)}
            onDelete={(item) => handleAction('delete-document', item)}
            columns={[
              { key: 'title', label: 'Título' },
              { 
                key: 'templateType', 
                label: 'Tipo',
                render: (value) => (
                  <span className="px-2 py-1 bg-purple-900 text-purple-300 rounded text-xs capitalize">
                    {value}
                  </span>
                )
              },
              { 
                key: 'isPublic', 
                label: 'Público',
                render: (value) => (
                  <span className={`px-2 py-1 rounded text-xs ${
                    value ? 'bg-green-900 text-green-300' : 'bg-gray-900 text-gray-300'
                  }`}>
                    {value ? 'Sim' : 'Não'}
                  </span>
                )
              },
            ]}
          />
        );

      case 'recipients':
        return (
          <SectionCard
            title="Destinatários"
            items={mockRecipients}
            onAdd={() => handleAction('add-recipient')}
            onView={(item) => handleAction('view-recipient', item)}
            onEdit={(item) => handleAction('edit-recipient', item)}
            onDelete={(item) => handleAction('delete-recipient', item)}
            columns={[
              { key: 'name', label: 'Nome' },
              { key: 'email', label: 'Email' },
              { 
                key: 'tags', 
                label: 'Tags',
                render: (value) => (
                  <div className="flex gap-1">
                    {value.map((tag: string, idx: number) => (
                      <span key={idx} className="px-2 py-1 bg-yellow-900 text-yellow-300 rounded text-xs">
                        {tag}
                      </span>
                    ))}
                  </div>
                )
              },
            ]}
          />
        );

      case 'lists':
        return (
          <SectionCard
            title="Listas de Destinatários"
            items={mockLists}
            onAdd={() => handleAction('add-list')}
            onView={(item) => handleAction('view-list', item)}
            onEdit={(item) => handleAction('edit-list', item)}
            onDelete={(item) => handleAction('delete-list', item)}
            columns={[
              { key: 'name', label: 'Nome' },
              { 
                key: 'recipientCount', 
                label: 'Destinatários',
                render: (value) => (
                  <span className="px-2 py-1 bg-indigo-900 text-indigo-300 rounded text-xs">
                    {value} destinatários
                  </span>
                )
              },
            ]}
          />
        );

      default:
        return null;
    }
  };

  return (
    <div className="bg-slate-900 min-h-screen">
      <div className="max-w-7xl mx-auto p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <img
              src="/logo.png"
              alt="DeMolay"
              className="w-10 h-10 object-contain"
            />
            <div>
              <h1 className="text-2xl font-bold text-white">
                OS do Capítulo DeMolay
              </h1>
              <p className="text-slate-400">
                Gestão de Documentos e Convites
              </p>
            </div>
          </div>
          <UserButton />
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
          <StatsCard 
            title="Papéis Timbrados" 
            value={mockLetterheads.length} 
            icon={Image} 
            color="text-blue-400" 
          />
          <StatsCard 
            title="Templates" 
            value={mockTemplates.length} 
            icon={FileText} 
            color="text-green-400" 
          />
          <StatsCard 
            title="Documentos" 
            value={mockDocuments.length} 
            icon={FileText} 
            color="text-purple-400" 
          />
          <StatsCard 
            title="Destinatários" 
            value={mockRecipients.length} 
            icon={Users} 
            color="text-yellow-400" 
          />
          <StatsCard 
            title="Listas" 
            value={mockLists.length} 
            icon={List} 
            color="text-indigo-400" 
          />
        </div>

        {/* Navigation Tabs */}
        <div className="flex flex-wrap gap-2 mb-6">
          {tabs.map((tab) => (
            <Button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              variant={activeTab === tab.id ? "default" : "ghost"}
              className={`${
                activeTab === tab.id
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-400 hover:text-white hover:bg-slate-700'
              }`}
            >
              <tab.icon className="w-4 h-4 mr-2" />
              {tab.label}
            </Button>
          ))}
        </div>

        {/* Tab Content */}
        {renderTabContent()}

        {/* Footer Note */}
        <div className="mt-8 pt-6 border-t border-slate-700">
          <div className="bg-yellow-900/20 border border-yellow-700/50 rounded-lg p-4">
            <p className="text-yellow-300 text-sm">
              <strong>Status:</strong> Interface de demonstração com dados mock. 
              As APIs backend estão implementadas e funcionais. 
              Próximos passos: conectar frontend às APIs reais via RPC.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default (parentRoute: RootRoute) =>
  createRoute({
    path: "/demolay",
    component: DeMolayPage,
    getParentRoute: () => parentRoute,
  });
