<?php

namespace Kanboard\Plugin\Gantt\Controller;

class ConfigController extends \Kanboard\Controller\ConfigController
{
    public function show()
    {
        $links = $this->linkModel->getAll();
        $linkLabels = array('' => t('None (disabled)'));
        $linkIds = array();

        foreach ($links as $link) {
            $linkIds[] = (int) $link['id'];
            if (!empty($link['opposite_id'])) {
                $linkLabels[$link['id']] = t($link['label']);
            }
        }

        $values = array(
            'gantt_dependency_link_id' => $this->configModel->get('gantt_dependency_link_id', '2'),
            'gantt_milestone_link_id' => $this->configModel->get('gantt_milestone_link_id', '9'),
            'gantt_task_sort' => $this->configModel->get('gantt_task_sort', 'board'),
        );

        $warnings = array();
        $depId = (int) $values['gantt_dependency_link_id'];
        if ($depId && !in_array($depId, $linkIds)) {
            $warnings[] = t('The configured dependency link type (ID %d) no longer exists. Please select a valid link type.', $depId);
        }
        $mileId = (int) $values['gantt_milestone_link_id'];
        if ($mileId && !in_array($mileId, $linkIds)) {
            $warnings[] = t('The configured milestone link type (ID %d) no longer exists. Please select a valid link type.', $mileId);
        }

        $this->response->html($this->helper->layout->config('Gantt:config/gantt', array(
            'title' => t('Settings').' &gt; '.t('Gantt settings'),
            'link_labels' => $linkLabels,
            'values' => $values,
            'warnings' => $warnings,
        )));
    }

    public function save()
    {
        $values = $this->request->getValues();

        if ($this->configModel->save($values)) {
            $this->flash->success(t('Settings saved successfully.'));
        } else {
            $this->flash->failure(t('Unable to save your settings.'));
        }

        $this->response->redirect($this->helper->url->to('ConfigController', 'show', array('plugin' => 'Gantt')));
    }
}
