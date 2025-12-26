import { Fragment } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { X, Trophy, Swords, Trash2, CircleHelp } from 'lucide-react';

interface HelpDialogProps {
    isOpen: boolean;
    onClose: () => void;
}

export function HelpDialog({ isOpen, onClose }: HelpDialogProps) {
    return (
        <Transition appear show={isOpen} as={Fragment}>
            <Dialog as="div" className="relative z-[100]" onClose={onClose}>
                <Transition.Child
                    as={Fragment}
                    enter="ease-out duration-300"
                    enterFrom="opacity-0"
                    enterTo="opacity-100"
                    leave="ease-in duration-200"
                    leaveFrom="opacity-100"
                    leaveTo="opacity-0"
                >
                    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" />
                </Transition.Child>

                <div className="fixed inset-0 overflow-y-auto">
                    <div className="flex min-h-full items-center justify-center p-4 text-center">
                        <Transition.Child
                            as={Fragment}
                            enter="ease-out duration-300"
                            enterFrom="opacity-0 scale-95"
                            enterTo="opacity-100 scale-100"
                            leave="ease-in duration-200"
                            leaveFrom="opacity-100 scale-100"
                            leaveTo="opacity-0 scale-95"
                        >
                            <Dialog.Panel className="w-full max-w-2xl transform overflow-hidden rounded-2xl bg-slate-900 border border-slate-800 p-8 text-left align-middle shadow-2xl transition-all">
                                <div className="flex justify-between items-start mb-6">
                                    <Dialog.Title as="h3" className="text-2xl font-bold text-white flex items-center gap-3">
                                        <div className="p-2 bg-indigo-500/10 rounded-lg">
                                            <CircleHelp className="w-6 h-6 text-indigo-400" />
                                        </div>
                                        How HackDuel Works
                                    </Dialog.Title>
                                    <button
                                        onClick={onClose}
                                        className="text-slate-500 hover:text-white transition-colors"
                                    >
                                        <X className="w-6 h-6" />
                                    </button>
                                </div>

                                <div className="space-y-8">
                                    {/* Section 1: Judging */}
                                    <div className="bg-slate-800/30 rounded-xl p-5 border border-slate-700/50">
                                        <h4 className="flex items-center gap-2 text-lg font-semibold text-indigo-300 mb-3">
                                            <Swords className="w-5 h-5" />
                                            Judging Projects
                                        </h4>
                                        <p className="text-slate-300 leading-relaxed">
                                            Instead of arbitrary 1-10 scores, we use <strong>Pairwise Comparisons</strong>.
                                            You are shown two projects side-by-side. Simply pick the one you feel is better based on
                                            <strong> Impact</strong>, <strong>Technicality</strong>, and <strong>Creativity</strong>.
                                        </p>
                                        <div className="mt-3 text-sm text-slate-400 italic">
                                            "Is the project on the left better than the one on the right?"
                                        </div>
                                    </div>

                                    {/* Section 2: Ranking Logic */}
                                    <div className="bg-slate-800/30 rounded-xl p-5 border border-slate-700/50">
                                        <h4 className="flex items-center gap-2 text-lg font-semibold text-amber-300 mb-3">
                                            <Trophy className="w-5 h-5" />
                                            How Leaders are Decided
                                        </h4>
                                        <p className="text-slate-300 leading-relaxed">
                                            We use the <strong>TrueSkill</strong> algorithm (similar to Xbox Live matchmaking).
                                            Beating a high-ranked project gives more points than beating a low-ranked one.
                                            The system intelligently selects pairs to maximize information gain, helping the best projects rise to the top quickly.
                                        </p>
                                    </div>

                                    {/* Section 3: Archiving */}
                                    <div className="bg-slate-800/30 rounded-xl p-5 border border-slate-700/50">
                                        <h4 className="flex items-center gap-2 text-lg font-semibold text-red-400 mb-3">
                                            <Trash2 className="w-5 h-5" />
                                            Removing Projects
                                        </h4>
                                        <p className="text-slate-300 leading-relaxed">
                                            Encountered a broken link, spam, or an empty submission?
                                            Hover over the project card and click the <strong>Trash Icon</strong> (Archive).
                                            This removes the project from the active judging pool so no one else has to waste time on it.
                                        </p>
                                    </div>
                                </div>

                                <div className="mt-8 pt-6 border-t border-slate-800 flex justify-end">
                                    <button
                                        onClick={onClose}
                                        className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-medium transition-colors"
                                    >
                                        Got it, let's judge!
                                    </button>
                                </div>
                            </Dialog.Panel>
                        </Transition.Child>
                    </div>
                </div>
            </Dialog>
        </Transition>
    );
}
