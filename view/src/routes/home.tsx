import { createRoute, type RootRoute, Link } from "@tanstack/react-router";
import { CheckCircle, Circle, Loader, Sparkles, Trash2, ArrowRight, FileText } from "lucide-react";
import {
  useDeleteTodo,
  useGenerateTodoWithAI,
  useListTodos,
  useOptionalUser,
  useToggleTodo,
} from "@/lib/hooks";
import LoggedProvider from "@/components/logged-provider";
import { Button } from "@/components/ui/button";
import { UserButton } from "@/components/user-button";

function PublicTodoList() {
  const { data: todos } = useListTodos();
  const toggleTodo = useToggleTodo();
  const deleteTodo = useDeleteTodo();

  const handleToggle = (todoId: number) => {
    toggleTodo.mutate(todoId);
  };

  const handleDelete = (e: React.MouseEvent, todoId: number) => {
    e.stopPropagation(); // Prevent triggering the toggle
    deleteTodo.mutate(todoId);
  };

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-medium text-white">TODOs (Public)</h2>

      {todos?.todos && todos.todos.length > 0
        ? (
          <div className="space-y-2">
            {todos.todos.slice(0, 3).map((todo) => (
              <div
                key={todo.id}
                className="group relative bg-slate-800 border border-slate-700 rounded-lg p-3 flex items-center gap-3 hover:bg-slate-700 transition-colors"
              >
                <button
                  onClick={() => handleToggle(todo.id)}
                  disabled={toggleTodo.isPending || deleteTodo.isPending}
                  className="flex-1 flex items-center gap-3 disabled:cursor-not-allowed text-left"
                >
                  <div className="flex-shrink-0">
                    {toggleTodo.isPending && toggleTodo.variables === todo.id
                      ? (
                        <Loader className="w-4 h-4 text-slate-400 animate-spin" />
                      )
                      : todo.completed
                      ? <CheckCircle className="w-4 h-4 text-slate-400" />
                      : <Circle className="w-4 h-4 text-slate-500" />}
                  </div>
                  <span
                    className={`flex-1 text-sm ${
                      todo.completed
                        ? "text-slate-400 line-through"
                        : "text-slate-200"
                    }`}
                  >
                    {todo.title}
                  </span>
                </button>

                {/* Delete button - only visible on hover */}
                <button
                  onClick={(e) => handleDelete(e, todo.id)}
                  disabled={deleteTodo.isPending || toggleTodo.isPending}
                  className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 p-1 hover:bg-slate-600 rounded disabled:cursor-not-allowed flex-shrink-0"
                  title="Delete todo"
                >
                  {deleteTodo.isPending && deleteTodo.variables === todo.id
                    ? <Loader className="w-3 h-3 text-slate-400 animate-spin" />
                    : (
                      <Trash2 className="w-3 h-3 text-slate-400 hover:text-red-400 transition-colors" />
                    )}
                </button>
              </div>
            ))}
            {todos.todos.length > 3 && (
              <p className="text-xs text-slate-500 text-center">
                +{todos.todos.length - 3} more
              </p>
            )}
          </div>
        )
        : (
          <div className="bg-slate-800 border border-slate-700 rounded-lg p-4 text-center">
            <p className="text-sm text-slate-400">No todos yet</p>
          </div>
        )}
    </div>
  );
}

function LoggedInContent() {
  const generateTodo = useGenerateTodoWithAI();

  const handleGenerateTodo = () => {
    generateTodo.mutate();
  };

  return (
    <div className="space-y-4">
      <h2 className="text-sm font-medium text-slate-400">
        This content only shows up for authenticated users
      </h2>
      <div className="bg-slate-800 border border-slate-700 rounded-lg p-4 text-center">
        <h3 className="text-sm font-medium text-white mb-2">
          Authenticated Content
        </h3>
        <p className="text-xs text-slate-400 mb-4">
          This content is only visible when logged in.
        </p>

        {/* Generate TODO Button - Eye-catching */}
        <div className="mb-4">
          <Button
            onClick={handleGenerateTodo}
            disabled={generateTodo.isPending}
            size="sm"
            className="bg-blue-600 text-white hover:bg-blue-500 border-blue-500 shadow-lg hover:shadow-xl transition-all duration-200 font-medium"
          >
            {generateTodo.isPending
              ? (
                <>
                  <Loader className="w-3 h-3 animate-spin mr-2" />
                  Generating...
                </>
              )
              : (
                <>
                  <Sparkles className="w-3 h-3 mr-2" />
                  Generate TODO with AI
                </>
              )}
          </Button>
        </div>
      </div>
    </div>
  );
}

function PublicFallback() {
  return (
    <div className="space-y-4">
      <h2 className="text-sm font-medium text-slate-400">
        The content below is only visible for authenticated users
      </h2>
      <div className="bg-slate-800 border border-slate-700 rounded-lg p-4 text-center">
        <h3 className="text-sm font-medium text-white mb-2">Login Required</h3>
        <p className="text-xs text-slate-400 mb-3">
          Sign in to access authenticated features.
        </p>
        <UserButton />
      </div>
    </div>
  );
}

function HomePage() {
  const user = useOptionalUser();

  return (
    <div className="bg-slate-900 min-h-screen flex items-center justify-center p-6">
      <div className="max-w-4xl mx-auto w-full">
        {/* Header */}
        <div className="flex items-center justify-between mb-12">
          <div className="flex items-center gap-3">
            <img
              src="/logo.png"
              alt="Deco"
              className="w-8 h-8 object-contain"
            />
            <div>
              <h1 className="text-xl font-semibold text-white">
                OS do Capítulo DeMolay
              </h1>
              <p className="text-sm text-slate-400">
                Sistema de Gestão de Documentos e Convites
              </p>
            </div>
          </div>

          <UserButton />
        </div>

        {/* Main Content Grid */}
        <div className="grid md:grid-cols-2 gap-8 min-h-[400px]">
          {/* Left Column - DeMolay System */}
          <div className="space-y-6">
            {/* DeMolay System Card */}
            <div className="bg-slate-800 border border-slate-700 rounded-lg p-6">
              <div className="flex items-center gap-3 mb-4">
                <FileText className="w-6 h-6 text-blue-400" />
                <h2 className="text-lg font-medium text-white">Sistema DeMolay</h2>
              </div>
              <p className="text-sm text-slate-400 mb-4">
                Gerencie papéis timbrados, templates, documentos, destinatários e listas de envio.
              </p>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-4 text-xs">
                  <div className="bg-slate-700/50 rounded p-2 text-center">
                    <div className="text-blue-400 font-medium">30+</div>
                    <div className="text-slate-400">APIs CRUD</div>
                  </div>
                  <div className="bg-slate-700/50 rounded p-2 text-center">
                    <div className="text-green-400 font-medium">5</div>
                    <div className="text-slate-400">Domínios</div>
                  </div>
                </div>
                <Link to="/demolay">
                  <Button className="w-full bg-blue-600 hover:bg-blue-500 text-white">
                    Acessar Sistema
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </Link>
              </div>
            </div>
            
            {/* Legacy TODOs */}
            <div className="bg-slate-800/50 border border-slate-700/50 rounded-lg p-4">
              <h3 className="text-sm font-medium text-slate-400 mb-3">TODOs (Legacy)</h3>
              <PublicTodoList />
            </div>
          </div>

          {/* Right Column - Auth Content */}
          <div>
            {user.data
              ? (
                <LoggedProvider>
                  <LoggedInContent />
                </LoggedProvider>
              )
              : <PublicFallback />}
          </div>
        </div>

        {/* Footer */}
        <div className="mt-12 pt-6 border-t border-slate-700">
          <p className="text-xs text-slate-500 text-center">
            Sistema DeMolay: 30+ Tools CRUD, 5 Domínios, Database (SQLite + Drizzle), 
            Geração de PDF (TODO), IA nativa para templates
          </p>
        </div>
      </div>
    </div>
  );
}

export default (parentRoute: RootRoute) =>
  createRoute({
    path: "/legacy",
    component: HomePage,
    getParentRoute: () => parentRoute,
  });
